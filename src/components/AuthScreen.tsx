import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, CheckCircle2, LockKeyhole, Sparkles } from "lucide-react";
import { getSupabase } from "../lib/supabase";

type Props = { onAuthenticated: () => void };

export default function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const supabase = getSupabase();
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (data.session) onAuthenticated();
        else setMessage("Check your email for a confirmation link, then return here to sign in.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        onAuthenticated();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand brand-light"><span className="brand-mark"><BookOpen size={19} /></span><span>notelink</span></div>
        <div className="auth-story-copy">
          <div className="eyebrow"><Sparkles size={14} /> A clearer way to think</div>
          <h1>Your notes should talk to each other.</h1>
          <p>Capture a thought, connect it to another, and gradually build a map of what you know.</p>
          <div className="story-points">
            <div><CheckCircle2 size={17} /><span>Keep ideas small and easy to revisit.</span></div>
            <div><CheckCircle2 size={17} /><span>Make relationships explicit, not buried.</span></div>
            <div><CheckCircle2 size={17} /><span>Use AI as a helper, never as the author.</span></div>
          </div>
        </div>
        <div className="auth-footer">A personal workspace for connected thinking.</div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form-card">
          <div className="auth-mobile-brand brand"><span className="brand-mark"><BookOpen size={19} /></span><span>notelink</span></div>
          <div className="auth-heading">
            <span className="icon-tile"><LockKeyhole size={19} /></span>
            <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
            <h2>{mode === "signin" ? "Welcome back" : "Create your workspace"}</h2>
            <p className="muted">{mode === "signin" ? "Pick up where your thinking left off." : "Start connecting your ideas in one calm space."}</p>
          </div>
          <form onSubmit={submit} className="auth-form">
            <label htmlFor="auth-email">Email address</label>
            <input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required />
            <div className="label-row"><label htmlFor="auth-password">Password</label><span>At least 8 characters</span></div>
            <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8+ characters" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} required />
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            {message && <div className="notice notice-success" role="status">{message}</div>}
            <button className="button button-primary button-full" type="submit" disabled={loading}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"} <ArrowRight size={16} />
            </button>
          </form>
          <p className="auth-switch">{mode === "signin" ? "New to NoteLink?" : "Already have an account?"}<button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); setError(""); }}>{mode === "signin" ? "Create account" : "Sign in"}</button></p>
          <p className="auth-privacy">Your notes are private to your account by default.</p>
        </div>
      </section>
    </main>
  );
}
