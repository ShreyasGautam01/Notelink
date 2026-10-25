import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Command,
  FileDown, FilePlus2, Hash, Link2, LoaderCircle, LogOut, MoreHorizontal, Network,
  Pin, Plus, Search, Send, Sparkles, Trash2, X,
} from "lucide-react";
import AuthScreen from "./components/AuthScreen";
import NoteGraph from "./components/NoteGraph";
import { filterNotes, relativeDate } from "./lib/note-utils";
import { getSupabase, isSupabaseConfigured } from "./lib/supabase";
import type { LinkType, Note, NoteLink, NotePatch } from "./types";
import { LINK_TYPES, linkLabel } from "./types";

type Screen = "notes" | "graph";
type AiAction = "explain" | "improve" | "summarize" | "generate";

async function getAiInvocationError(caught: unknown): Promise<string> {
  if (caught && typeof caught === "object") {
    const candidate = caught as { message?: unknown; context?: unknown };
    if (candidate.context instanceof Response) {
      try {
        const payload = await candidate.context.clone().json() as { error?: unknown };
        if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
      } catch {
        // The response may not contain JSON; fall back to the SDK's error message.
      }
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
  }
  return "AI assistance failed. Please try again.";
}

const COLORS = ["#D9E8E4", "#F7DCC9", "#E8DDF8", "#F5E6A9", "#CFE3F8", "#E9D9D4"];
const AI_ACTIONS: { action: AiAction; title: string; description: string }[] = [
  { action: "explain", title: "Explain this note", description: "Clarify the main idea in plain language." },
  { action: "improve", title: "Improve the writing", description: "Make it clearer without changing the meaning." },
  { action: "summarize", title: "Summarize", description: "Pull out the essential points." },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const notesRef = useRef<Note[]>([]);
  notesRef.current = notes;
  const [links, setLinks] = useState<NoteLink[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("notes");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All notes");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [notice, setNotice] = useState("");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkType, setLinkType] = useState<LinkType>("RELATED_TO");
  const [linkBusy, setLinkBusy] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiDraftTitle, setAiDraftTitle] = useState("");
  const [aiProviderNotice, setAiProviderNotice] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);

  const activeNote = notes.find((note) => note.id === activeId) ?? null;
  const categories = useMemo(() => Array.from(new Set(notes.map((note) => note.category?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)), [notes]);
  const visibleNotes = useMemo(() => filterNotes(notes, search, categoryFilter), [notes, search, categoryFilter]);
  const outgoing = useMemo(() => links.filter((link) => link.source_note_id === activeId), [links, activeId]);
  const incoming = useMemo(() => links.filter((link) => link.target_note_id === activeId), [links, activeId]);

  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthLoading(false); return; }
    const supabase = getSupabase();
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setSession(data.session); setAuthLoading(false); }
    }).catch(() => { if (alive) setAuthLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!session?.user.id) return;
    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const supabase = getSupabase();
      const [noteResult, linkResult] = await Promise.all([
        supabase.from("notes").select("*").order("updated_at", { ascending: false }),
        supabase.from("note_links").select("*").order("created_at", { ascending: false }),
      ]);
      if (noteResult.error) throw noteResult.error;
      if (linkResult.error) throw linkResult.error;
      const loadedNotes = (noteResult.data ?? []) as Note[];
      notesRef.current = loadedNotes;
      setNotes(loadedNotes);
      setLinks((linkResult.data ?? []) as NoteLink[]);
      setActiveId((current) => loadedNotes.some((note) => note.id === current) ? current : loadedNotes[0]?.id ?? null);
      setSaveStatus("saved");
    } catch (caught) {
      setWorkspaceError(caught instanceof Error ? caught.message : "Could not load your workspace.");
    } finally {
      setWorkspaceLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (session) void loadWorkspace();
    else { notesRef.current = []; setNotes([]); setLinks([]); setActiveId(null); }
  }, [session?.user.id, loadWorkspace]);

  useEffect(() => () => {
    saveTimers.current.forEach((timer) => clearTimeout(timer));
    saveTimers.current.clear();
  }, []);

  const createNote = useCallback(async (initialContent?: string, initialTitle?: string): Promise<boolean> => {
    if (!session) return false;
    setWorkspaceError("");
    setNotice("");
    try {
      const { data, error } = await getSupabase().from("notes").insert({
        user_id: session.user.id,
        title: initialTitle || "Untitled note",
        content: initialContent || "",
        category: null,
        color: initialContent ? COLORS[2] : COLORS[0],
      }).select("*").single();
      if (error) throw error;
      const note = data as Note;
      notesRef.current = [note, ...notesRef.current];
      setNotes(notesRef.current);
      setActiveId(note.id);
      setScreen("notes");
      setSearch("");
      setCategoryFilter("All notes");
      return true;
    } catch (caught) {
      setWorkspaceError(caught instanceof Error ? caught.message : "Could not create note.");
      return false;
    }
  }, [session]);

  function patchActive(patch: NotePatch) {
    if (!activeId) return;
    const existing = notesRef.current.find((note) => note.id === activeId);
    if (!existing) return;
    const nextNote = { ...existing, ...patch };
    notesRef.current = notesRef.current.map((note) => note.id === activeId ? nextNote : note);
    setNotes(notesRef.current);
    setSaveStatus("saving");
    setWorkspaceError("");
    const oldTimer = saveTimers.current.get(activeId);
    if (oldTimer) clearTimeout(oldTimer);
    const id = activeId;
    const snapshot = {
      title: nextNote.title,
      content: nextNote.content,
      category: nextNote.category,
      color: nextNote.color,
      is_pinned: nextNote.is_pinned,
    };
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await getSupabase().from("notes").update(snapshot).eq("id", id).select("updated_at").single();
        if (error) throw error;
        notesRef.current = notesRef.current.map((note) => note.id === id ? { ...note, updated_at: data.updated_at } : note);
        setNotes(notesRef.current);
        setSaveStatus("saved");
      } catch (caught) {
        setSaveStatus("error");
        setNotice(caught instanceof Error ? "Save failed: " + caught.message : "Save failed. Check your connection.");
      } finally {
        saveTimers.current.delete(id);
      }
    }, 650);
    saveTimers.current.set(id, timer);
  }

  async function deleteActiveNote() {
    if (!activeNote) return;
    if (!window.confirm("Delete “" + activeNote.title + "”? This also removes its links.")) return;
    const id = activeNote.id;
    const timer = saveTimers.current.get(id);
    if (timer) clearTimeout(timer);
    saveTimers.current.delete(id);
    const { error } = await getSupabase().from("notes").delete().eq("id", id);
    if (error) { setNotice("Could not delete note: " + error.message); return; }
    const remaining = notesRef.current.filter((note) => note.id !== id);
    notesRef.current = remaining;
    setNotes(remaining);
    setLinks((current) => current.filter((link) => link.source_note_id !== id && link.target_note_id !== id));
    setActiveId(remaining[0]?.id ?? null);
    setNotice("Note deleted.");
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeNote || !linkTarget || !session) return;
    setLinkBusy(true);
    setNotice("");
    try {
      const { data, error } = await getSupabase().from("note_links").insert({
        user_id: session.user.id,
        source_note_id: activeNote.id,
        target_note_id: linkTarget,
        label: linkType,
      }).select("*").single();
      if (error) {
        if (error.code === "23505") throw new Error("That relationship already exists.");
        throw error;
      }
      setLinks((current) => [data as NoteLink, ...current]);
      setShowLinkModal(false);
      setLinkTarget("");
      setNotice("Connection created.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Could not create connection.");
    } finally { setLinkBusy(false); }
  }

  async function removeLink(linkId: string) {
    const { error } = await getSupabase().from("note_links").delete().eq("id", linkId);
    if (error) { setNotice("Could not remove connection: " + error.message); return; }
    setLinks((current) => current.filter((link) => link.id !== linkId));
  }

  async function runAi(action: AiAction) {
    if (action !== "generate" && !activeNote?.content.trim()) {
      setAiError("Add some text to the note first.");
      setShowAiPanel(true);
      return;
    }
    if (action === "generate" && aiPrompt.trim().length < 5) {
      setAiError("Describe the note you want to create in a little more detail.");
      setShowAiPanel(true);
      return;
    }
    setAiAction(action);
    setAiBusy(true);
    setAiError("");
    setAiResult("");
    setAiDraftTitle("");
    setAiProviderNotice("");
    setShowAiPanel(true);
    try {
      const { data, error } = await getSupabase().functions.invoke("ai-note-assist", {
        body: { action, content: activeNote?.content ?? "", prompt: aiPrompt.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (typeof data?.text !== "string" || !data.text.trim()) throw new Error("The AI returned an empty draft. Try again.");
      setAiResult(data.text.trim());
      setAiDraftTitle(typeof data.title === "string" ? data.title.trim() : "");
      setAiProviderNotice(data.fallbackUsed === true
        ? "Gemini was unavailable; this draft was generated with Groq."
        : data.provider === "groq"
          ? "This draft was generated with Groq because Gemini is not configured."
          : "");
    } catch (caught) {
      setAiError(await getAiInvocationError(caught));
    } finally { setAiBusy(false); }
  }

  async function applyAiResult() {
    if (!aiResult) return;
    if (aiAction === "generate") {
      const proposedTitle = aiDraftTitle || aiPrompt.trim().split(/\s+/).slice(0, 7).join(" ").replace(/[.?!]$/, "").slice(0, 70) || "AI draft";
      const created = await createNote(aiResult, proposedTitle);
      if (!created) return;
      setNotice("AI draft saved as a new note. Review it before relying on it.");
    } else {
      patchActive({ content: aiResult });
      setNotice("AI draft placed in the editor. Review before relying on it.");
    }
    setShowAiPanel(false);
    setAiResult("");
  }

  function exportWorkspace() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), format: "notelink-export-v1", notes, links }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "notelink-export-" + new Date().toISOString().slice(0, 10) + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Workspace exported as JSON.");
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    setSession(null);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
      if (modifier && event.key.toLowerCase() === "n") { event.preventDefault(); void createNote(); }
      if (event.key === "Escape") { setShowLinkModal(false); if (!aiBusy) setShowAiPanel(false); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createNote, aiBusy]);

  if (!isSupabaseConfigured) return <div className="setup-page"><div className="setup-card">
    <span className="brand-mark"><BookOpen size={20} /></span><p className="eyebrow">ONE-TIME SETUP</p>
    <h1>Connect NoteLink to Supabase</h1>
    <p>The project code is ready, but this environment needs the project's public client settings.</p>
    <ol><li>Copy <strong>.env.example</strong> to <strong>.env.local</strong>.</li><li>Keep the project URL already provided in the example file.</li><li>Paste the Supabase <strong>publishable key</strong> into VITE_SUPABASE_PUBLISHABLE_KEY.</li><li>Restart the development server.</li></ol>
    <a className="button button-primary button-full" href="https://supabase.com/dashboard/project/rqfjaxoelszrhsetpddv/settings/api-keys" target="_blank" rel="noreferrer">Open Supabase API keys <ArrowRight size={16} /></a>
    <p className="security-note">Use a publishable key only. Never add a secret or service-role key to frontend environment variables.</p>
  </div></div>;

  if (authLoading) return <div className="loading-screen"><LoaderCircle className="spin" size={25} /><span>Opening your workspace…</span></div>;
  if (!session) return <AuthScreen onAuthenticated={() => { void getSupabase().auth.getSession().then(({ data }) => setSession(data.session)); }} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand brand-sidebar"><span className="brand-mark"><BookOpen size={18} /></span><span>notelink</span><span className="brand-dot" /></div>
      <button className="workspace-switcher" type="button"><span className="workspace-avatar">{(session.user.email ?? "N").slice(0, 1).toUpperCase()}</span><span className="workspace-user"><strong>My workspace</strong><small>{session.user.email}</small></span><ChevronDown size={15} /></button>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Workspace views">
        <button className={screen === "notes" ? "nav-item active" : "nav-item"} onClick={() => setScreen("notes")}><BookOpen size={17} /><span>Notes</span><span className="nav-count">{notes.length}</span></button>
        <button className={screen === "graph" ? "nav-item active" : "nav-item"} onClick={() => setScreen("graph")}><Network size={17} /><span>Knowledge graph</span></button>
      </nav>
      <div className="notes-header"><span className="sidebar-section-label">YOUR NOTES</span><button className="icon-button sidebar-add" title="New note (Ctrl/⌘ + N)" onClick={() => void createNote()}><Plus size={16} /></button></div>
      <div className="sidebar-search"><Search size={15} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes…" aria-label="Search notes" /><kbd><Command size={10} /> K</kbd></div>
      <div className="category-filter"><button className={categoryFilter === "All notes" ? "category-chip active" : "category-chip"} onClick={() => setCategoryFilter("All notes")}>All notes</button>{categories.map((category) => <button key={category} className={categoryFilter === category ? "category-chip active" : "category-chip"} onClick={() => setCategoryFilter(category)}>{category}</button>)}</div>
      <div className="note-list" aria-label="Notes">
        {workspaceLoading && notes.length === 0 ? <div className="sidebar-loading"><LoaderCircle size={16} className="spin" /> Loading notes…</div> : visibleNotes.map((note) => <button key={note.id} className={"note-list-item " + (activeId === note.id && screen === "notes" ? "selected" : "")} onClick={() => { setActiveId(note.id); setScreen("notes"); }}>
          <span className="note-list-icon" style={{ backgroundColor: note.color }}><span /></span><span className="note-list-copy"><span className="note-list-title">{note.title || "Untitled note"}</span><span className="note-list-preview">{note.content.trim().replace(/\s+/g, " ") || "No content yet"}</span></span>{note.is_pinned && <Pin size={12} className="muted-icon" />}
        </button>)}
        {!workspaceLoading && visibleNotes.length === 0 && <div className="sidebar-empty">{search ? "No matching notes." : "Nothing here yet. Create a note to begin."}</div>}
      </div>
      <div className="sidebar-bottom">
        <button className="utility-row" onClick={exportWorkspace}><FileDown size={16} /><span>Export workspace</span></button>
        <button className="utility-row" onClick={() => { setAiAction("generate"); setAiPrompt(""); setAiResult(""); setAiDraftTitle(""); setAiProviderNotice(""); setAiError(""); setShowAiPanel(true); }}><Sparkles size={16} /><span>AI note assistant</span><span className="tiny-new">BETA</span></button>
        <div className="sidebar-bottom-user"><span className="avatar">{(session.user.email ?? "N").slice(0, 1).toUpperCase()}</span><span className="user-email">{session.user.email}</span><button className="icon-button" onClick={() => void signOut()} title="Sign out"><LogOut size={15} /></button></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ArrowRight size={13} /><strong>{screen === "notes" ? (activeNote?.title || "Notes") : "Knowledge graph"}</strong></div><div className="topbar-actions">
        <span className={"save-indicator " + (saveStatus === "error" ? "save-error" : "")}>{saveStatus === "saving" ? <><LoaderCircle size={13} className="spin" /> Saving</> : saveStatus === "error" ? "Save issue" : <><Check size={13} /> Saved</>}</span><span className="topbar-divider" />
        {screen === "notes" && activeNote && <button className="icon-button" title={activeNote.is_pinned ? "Unpin note" : "Pin note"} onClick={() => patchActive({ is_pinned: !activeNote.is_pinned })}><Pin size={16} className={activeNote.is_pinned ? "pinned" : ""} /></button>}
        {screen === "notes" && activeNote && <button className="icon-button danger-hover" title="Delete note" onClick={() => void deleteActiveNote()}><Trash2 size={16} /></button>}
        <button className="button button-primary button-small" onClick={() => void createNote()}><Plus size={15} /> New note</button>
      </div></header>
      {workspaceError && <div className="notice notice-error page-notice" role="alert">{workspaceError}<button className="icon-button" onClick={() => void loadWorkspace()} title="Retry"><ArrowRight size={14} /></button></div>}
      {notice && <div className="notice notice-neutral page-notice" role="status">{notice}<button className="notice-close" onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={14} /></button></div>}

      {screen === "graph" ? <section className="graph-page">
        <div className="page-title-row"><div><p className="eyebrow">SEE THE BIG PICTURE</p><h1>Knowledge graph</h1><p className="muted">Your ideas, and the relationships between them.</p></div><button className="button button-secondary" onClick={() => setScreen("notes")}><ArrowLeft size={15} /> Back to notes</button></div>
        <div className="graph-card"><NoteGraph notes={notes} links={links} selectedId={activeId} onSelect={(id) => { setActiveId(id); setScreen("notes"); }} /></div>
        <div className="graph-legend">{LINK_TYPES.slice(0, 4).map((item) => <span key={item.value}><i />{item.label}</span>)}</div>
      </section> : activeNote ? <div className="editor-layout">
        <section className="editor-column">
          <div className="editor-toolbar"><div className="editor-path"><span className="doc-icon" style={{ backgroundColor: activeNote.color }} /><span>{activeNote.category || "Uncategorized"}</span><span className="path-dot">/</span><span>{relativeDate(activeNote.updated_at)}</span></div><div className="editor-toolbar-actions"><span className="plain-badge">PRIVATE</span><button className="icon-button" title="Create a connection" onClick={() => { setLinkTarget(""); setShowLinkModal(true); }}><Link2 size={16} /></button><button className="icon-button" title="Open AI assistant" onClick={() => { setAiAction("explain"); setAiResult(""); setAiDraftTitle(""); setAiProviderNotice(""); setAiError(""); setShowAiPanel(true); }}><MoreHorizontal size={18} /></button></div></div>
          <div className="editor-content"><div className="note-title-row"><input className="note-title-input" value={activeNote.title} maxLength={160} onChange={(event) => patchActive({ title: event.target.value })} aria-label="Note title" placeholder="Give this idea a name…" /><span className="title-counter">{activeNote.title.length}/160</span></div>
            <div className="note-metadata"><label className="metadata-field"><Hash size={14} /><input value={activeNote.category ?? ""} maxLength={80} placeholder="Add category" aria-label="Category" onChange={(event) => patchActive({ category: event.target.value.trim() ? event.target.value : null })} /></label><div className="color-picker" aria-label="Note color">{COLORS.map((color) => <button key={color} aria-label={"Set note color " + color} title={color} className={"color-swatch " + (activeNote.color === color ? "chosen" : "")} style={{ backgroundColor: color }} onClick={() => patchActive({ color })} />)}</div></div>
            <textarea className="note-body-input" value={activeNote.content} maxLength={50000} onChange={(event) => patchActive({ content: event.target.value })} placeholder={"Start with one idea.\n\nWhat do you want to remember? What does it connect to? Keep it small enough to think with, then link it to related ideas."} aria-label="Note content" spellCheck />
            <div className="editor-footer"><span><span className="footer-dot" /> {activeNote.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0} words</span><span>Plain text · Markdown-friendly</span><span>Last edited {relativeDate(activeNote.updated_at)}</span></div>
          </div>
        </section>
        <aside className="context-column">
          <div className="context-heading"><div><p className="eyebrow">NOTE CONTEXT</p><h2>Connections</h2></div><button className="icon-button" onClick={() => { setLinkTarget(""); setShowLinkModal(true); }} title="Add connection"><Plus size={16} /></button></div>
          <div className="connection-section"><div className="connection-label"><span>OUTGOING</span><span>{outgoing.length}</span></div>
            {outgoing.length ? outgoing.map((link) => { const target = notes.find((note) => note.id === link.target_note_id); if (!target) return null; return <div className="connection-item" key={link.id}><span className="connection-line" /><button className="connection-main" onClick={() => setActiveId(target.id)}><span className="connection-title">{target.title}</span><span className="connection-type">{linkLabel(link.label)}</span></button><button className="tiny-icon-button" title="Remove connection" onClick={() => void removeLink(link.id)}><X size={12} /></button></div>; }) : <p className="connection-empty">Connect this idea to something it uses, extends, or relates to.</p>}
          </div>
          <div className="connection-section backlinks-section"><div className="connection-label"><span><ArrowDownLeft size={13} /> BACKLINKS</span><span>{incoming.length}</span></div>
            {incoming.length ? incoming.map((link) => { const source = notes.find((note) => note.id === link.source_note_id); if (!source) return null; return <button className="backlink-item" key={link.id} onClick={() => setActiveId(source.id)}><span className="backlink-icon"><Link2 size={13} /></span><span><strong>{source.title}</strong><small>{linkLabel(link.label)}</small></span><ArrowRight size={13} /></button>; }) : <p className="connection-empty">Notes that link here will show up automatically.</p>}
          </div>
          <div className="ai-card"><div className="ai-card-title"><span className="ai-spark"><Sparkles size={15} /></span><div><strong>Think it through</strong><small>Optional AI assistance</small></div><span className="tiny-new">BETA</span></div><p>Get a clearer explanation or sharpen a draft. You decide what makes it into your notes.</p>
            <div className="ai-actions">{AI_ACTIONS.map((item) => <button key={item.action} className="ai-action" onClick={() => void runAi(item.action)}><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowRight size={14} /></button>)}</div>
            <button className="ai-generate-link" onClick={() => { setAiAction("generate"); setAiPrompt(""); setAiResult(""); setAiError(""); setAiDraftTitle(""); setAiProviderNotice(""); setShowAiPanel(true); }}>Draft a new note from a prompt <ArrowRight size={13} /></button>
          </div>
        </aside>
      </div> : <section className="welcome-empty"><div className="welcome-art"><div className="art-note art-note-a"><span /><span /><span /></div><div className="art-note art-note-b"><span /><span /></div><div className="art-node art-node-a" /><div className="art-node art-node-b" /><svg viewBox="0 0 200 130" aria-hidden="true"><path d="M46 65 L96 30 L149 74 L96 103 Z" /><path d="M46 65 L149 74" /></svg></div><p className="eyebrow">A SMALL IDEA CAN GO A LONG WAY</p><h1>Start with one thought.</h1><p className="muted">NoteLink gets more useful when your notes connect. Capture the idea first; make the connection when it becomes clear.</p><button className="button button-primary" onClick={() => void createNote()}><FilePlus2 size={16} /> Create your first note</button></section>}
    </main>

    {showLinkModal && activeNote && <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setShowLinkModal(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="link-modal-title"><div className="modal-heading"><div><p className="eyebrow">CONNECT TWO IDEAS</p><h2 id="link-modal-title">Add a connection</h2></div><button className="icon-button" onClick={() => setShowLinkModal(false)} aria-label="Close"><X size={17} /></button></div><p className="modal-description">Create a directional relationship from <strong>{activeNote.title}</strong> to another note.</p><form onSubmit={(event) => void createLink(event)} className="modal-form"><label htmlFor="target-note">Connect to</label><select id="target-note" value={linkTarget} onChange={(event) => setLinkTarget(event.target.value)} required><option value="">Choose a note…</option>{notes.filter((note) => note.id !== activeNote.id).map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}</select><label htmlFor="link-type">Relationship</label><select id="link-type" value={linkType} onChange={(event) => setLinkType(event.target.value as LinkType)}>{LINK_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><p className="modal-hint">{LINK_TYPES.find((type) => type.value === linkType)?.description}</p>{notes.length < 2 && <p className="notice notice-neutral">Create another note before adding a connection.</p>}<button className="button button-primary button-full" type="submit" disabled={linkBusy || !linkTarget || notes.length < 2}>{linkBusy ? "Connecting…" : "Create connection"} <ArrowRight size={15} /></button></form></section></div>}

    {showAiPanel && <div className="modal-backdrop ai-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !aiBusy) setShowAiPanel(false); }}><section className="modal-card ai-modal" role="dialog" aria-modal="true" aria-labelledby="ai-modal-title"><div className="modal-heading"><div><p className="eyebrow"><Sparkles size={12} /> AI NOTE ASSISTANT</p><h2 id="ai-modal-title">{aiAction === "generate" ? "Draft a new note" : aiAction ? AI_ACTIONS.find((item) => item.action === aiAction)?.title ?? "Note assistant" : "What would help?"}</h2></div><button className="icon-button" onClick={() => setShowAiPanel(false)} aria-label="Close" disabled={aiBusy}><X size={17} /></button></div><p className="modal-description">AI creates a draft for you to review. It never changes a saved note until you choose to apply the result.</p>
      <div className="ai-mode-tabs">{(["explain", "improve", "summarize", "generate"] as AiAction[]).map((action) => <button key={action} className={aiAction === action ? "active" : ""} onClick={() => { setAiAction(action); setAiResult(""); setAiError(""); setAiDraftTitle(""); setAiProviderNotice(""); }}>{action === "explain" ? "Explain" : action === "improve" ? "Improve" : action === "summarize" ? "Summarize" : "Generate"}</button>)}</div>
      {aiAction === "generate" ? <div className="ai-prompt-field"><label htmlFor="ai-prompt">What should the note cover?</label><textarea id="ai-prompt" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} maxLength={2000} rows={3} placeholder="Example: Explain how database indexes reduce query work, with one simple example." /></div> : <div className="ai-source-preview"><span className="eyebrow">SOURCE NOTE</span><strong>{activeNote?.title ?? "No note selected"}</strong><p>{activeNote?.content ? activeNote.content.slice(0, 240) + (activeNote.content.length > 240 ? "…" : "") : "This note is empty. Add some text before asking AI to work on it."}</p></div>}
      {aiError && <div className="notice notice-error" role="alert">{aiError}</div>}
      {aiProviderNotice && <div className="notice notice-neutral" role="status">{aiProviderNotice}</div>}
      {aiResult && <div className="ai-result"><div className="ai-result-heading"><span><Sparkles size={14} /> Draft result</span><button className="tiny-icon-button" onClick={() => { setAiResult(""); setAiDraftTitle(""); setAiProviderNotice(""); }} title="Discard draft"><X size={14} /></button></div>{aiAction === "generate" && aiDraftTitle && <div className="ai-result-title">{aiDraftTitle}</div>}<div className="ai-result-text">{aiResult}</div><div className="ai-result-actions"><button className="button button-secondary button-small" onClick={() => { const draftToCopy = aiAction === "generate" && aiDraftTitle ? "# " + aiDraftTitle + "\n\n" + aiResult : aiResult; void navigator.clipboard?.writeText(draftToCopy); setNotice("Draft copied to clipboard."); }}>Copy draft</button><button className="button button-primary button-small" onClick={() => void applyAiResult()}>{aiAction === "generate" ? "Create new note" : "Place in editor"} <ArrowRight size={14} /></button></div></div>}
      {!aiResult && <button className="button button-primary button-full" disabled={aiBusy || (aiAction === "generate" ? aiPrompt.trim().length < 5 : !activeNote?.content.trim())} onClick={() => void runAi(aiAction ?? "explain")}>{aiBusy ? <><LoaderCircle size={15} className="spin" /> Working on a draft…</> : <><Send size={15} /> Generate draft</>}</button>}
      <p className="ai-privacy-note">Only the text you submit is sent to an AI provider. If Gemini fails, it may also be sent to the configured backup provider (Groq). Avoid sensitive information. Usage is limited per account.</p>
    </section></div>}
  </div>;
}
