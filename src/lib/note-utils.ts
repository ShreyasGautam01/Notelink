import type { Note } from "../types";

export function filterNotes(notes: Note[], search: string, category: string): Note[] {
  const query = search.trim().toLocaleLowerCase();
  return notes.filter((note) => {
    const matchesCategory = category === "All notes" || (note.category ?? "Uncategorized") === category;
    if (!matchesCategory) return false;
    if (!query) return true;
    return [note.title, note.content, note.category ?? ""].some((value) => value.toLocaleLowerCase().includes(query));
  }).sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) ||
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function relativeDate(value: string, now = new Date()): string {
  const date = new Date(value);
  const ms = Math.max(0, now.getTime() - date.getTime());
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + "m ago";
  if (ms < 86_400_000) return Math.floor(ms / 3_600_000) + "h ago";
  if (ms < 604_800_000) return Math.floor(ms / 86_400_000) + "d ago";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
