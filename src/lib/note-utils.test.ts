import { describe, expect, it } from "vitest";
import { filterNotes, relativeDate } from "./note-utils";
import type { Note } from "../types";

const notes: Note[] = [
  { id: "1", user_id: "user", title: "Neural networks", content: "Learn gradient descent", category: "AI", color: "#D9E8E4", is_pinned: false, created_at: "2026-10-24T10:00:00Z", updated_at: "2026-10-24T10:00:00Z" },
  { id: "2", user_id: "user", title: "Database indexes", content: "Query planning", category: "Engineering", color: "#D9E8E4", is_pinned: true, created_at: "2026-10-24T11:00:00Z", updated_at: "2026-10-24T11:00:00Z" },
];

describe("filterNotes", () => {
  it("searches titles, content, and categories without case sensitivity", () => {
    expect(filterNotes(notes, "GRADIENT", "All notes").map((note) => note.id)).toEqual(["1"]);
    expect(filterNotes(notes, "engineering", "All notes").map((note) => note.id)).toEqual(["2"]);
  });
  it("filters categories and places pinned notes first", () => {
    expect(filterNotes(notes, "", "AI").map((note) => note.id)).toEqual(["1"]);
    expect(filterNotes(notes, "", "All notes").map((note) => note.id)).toEqual(["2", "1"]);
  });
});

describe("relativeDate", () => {
  it("formats recent updates", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(relativeDate("2026-10-25T11:59:30Z", now)).toBe("Just now");
    expect(relativeDate("2026-10-25T11:20:00Z", now)).toBe("40m ago");
  });
});
