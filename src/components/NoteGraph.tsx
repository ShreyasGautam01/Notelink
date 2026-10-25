import { useMemo } from "react";
import { Network } from "lucide-react";
import type { Note, NoteLink } from "../types";
import { linkLabel } from "../types";

type Props = { notes: Note[]; links: NoteLink[]; selectedId: string | null; onSelect: (id: string) => void };

export default function NoteGraph({ notes, links, selectedId, onSelect }: Props) {
  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number }>();
    const radiusX = Math.min(255, 105 + notes.length * 10);
    const radiusY = Math.min(155, 70 + notes.length * 6);
    notes.forEach((note, index) => {
      const angle = (Math.PI * 2 * index / Math.max(notes.length, 1)) - Math.PI / 2;
      result.set(note.id, { x: 360 + Math.cos(angle) * radiusX, y: 230 + Math.sin(angle) * radiusY });
    });
    return result;
  }, [notes]);

  if (notes.length === 0) return <div className="empty-graph"><span className="empty-illustration"><Network size={27} /></span><h3>Your map starts with one idea</h3><p>Create a note, then link it to another. Your knowledge graph grows as the relationships do.</p></div>;

  return <div className="graph-wrap">
    <div className="graph-caption"><span className="graph-dot" /> {notes.length} {notes.length === 1 ? "note" : "notes"} <span className="caption-divider">·</span> {links.length} {links.length === 1 ? "connection" : "connections"}</div>
    <svg viewBox="0 0 720 460" className="knowledge-graph" role="img" aria-label="Interactive map of notes and their connections">
      <defs><pattern id="graph-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#dfe4dc" /></pattern></defs>
      <rect width="720" height="460" fill="url(#graph-grid)" />
      {links.map((link) => {
        const source = positions.get(link.source_note_id);
        const target = positions.get(link.target_note_id);
        if (!source || !target) return null;
        return <g key={link.id}><line x1={source.x} y1={source.y} x2={target.x} y2={target.y} className="graph-edge" /><circle cx={(source.x + target.x) / 2} cy={(source.y + target.y) / 2} r="3" className="graph-edge-point" /><title>{linkLabel(link.label)}</title></g>;
      })}
      {notes.map((note) => {
        const point = positions.get(note.id);
        if (!point) return null;
        const selected = selectedId === note.id;
        return <g key={note.id} className={"graph-node " + (selected ? "graph-node-selected" : "")} transform={"translate(" + point.x + " " + point.y + ")"} onClick={() => onSelect(note.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(note.id); }} tabIndex={0} role="button" aria-label={"Open note " + note.title}>
          <circle r={selected ? 27 : 23} className="graph-node-halo" /><circle r="16" fill={note.color || "#D9E8E4"} className="graph-node-core" />
          <text y="39" textAnchor="middle" className="graph-node-label">{note.title.length > 19 ? note.title.slice(0, 17) + "…" : note.title}</text>
        </g>;
      })}
    </svg>
    <div className="graph-help">Select a node to open its note. Relationship details are available in the note editor.</div>
  </div>;
}
