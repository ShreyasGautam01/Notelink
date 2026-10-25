export type LinkType = "RELATED_TO" | "DEPENDS_ON" | "CONTRADICTS" | "IS_EXAMPLE_OF" | "EXTENDS" | "REFERENCES";

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string | null;
  color: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteLink {
  id: string;
  user_id: string;
  source_note_id: string;
  target_note_id: string;
  label: LinkType;
  created_at: string;
}

export type NotePatch = Partial<Pick<Note, "title" | "content" | "category" | "color" | "is_pinned">>;

export const LINK_TYPES: { value: LinkType; label: string; description: string }[] = [
  { value: "RELATED_TO", label: "Relates to", description: "A general conceptual connection" },
  { value: "DEPENDS_ON", label: "Depends on", description: "One idea requires the other" },
  { value: "CONTRADICTS", label: "Contradicts", description: "The ideas disagree or conflict" },
  { value: "IS_EXAMPLE_OF", label: "Is an example of", description: "A specific instance of a broader idea" },
  { value: "EXTENDS", label: "Extends", description: "Builds on or expands the idea" },
  { value: "REFERENCES", label: "References", description: "Points to a supporting source" },
];

export function linkLabel(value: string): string {
  return LINK_TYPES.find((item) => item.value === value)?.label ?? "Relates to";
}
