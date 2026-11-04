import { describe, expect, it } from "vitest";
import {
  parseAiDraft,
  readGeminiOutput,
  readGroqOutput,
} from "../../supabase/functions/ai-note-assist/ai-utils.ts";

describe("Gemini Interactions output parsing", () => {
  it("extracts only text from model-output steps", () => {
    const result = readGeminiOutput({
      steps: [
        { type: "thought", content: [{ type: "text", text: "not user-facing" }] },
        { type: "model_output", content: [{ type: "text", text: "# A title" }, { type: "text", text: "\n\nA body." }] },
      ],
    });
    expect(result).toBe("# A title\n\nA body.");
  });

  it("returns an empty string for an unexpected response shape", () => {
    expect(readGeminiOutput({ steps: "unexpected" })).toBe("");
  });
});

describe("Groq chat completion parsing", () => {
  it("accepts a normal stopped completion", () => {
    expect(readGroqOutput({
      choices: [{ finish_reason: "stop", message: { content: "A complete answer." } }],
    })).toEqual({ text: "A complete answer.", complete: true, finishReason: "stop" });
  });

  it("rejects a completion cut off by the token limit", () => {
    expect(readGroqOutput({
      choices: [{ finish_reason: "length", message: { content: "A truncated answer" } }],
    }).complete).toBe(false);
  });
});

describe("generated-note validation", () => {
  const completeBody = [
    "AI note assistants use language models to organize source material into clear, reusable notes.",
    "They can explain key terms, summarize long passages, and suggest examples that make difficult ideas easier to understand.",
    "A useful workflow begins with a clear topic, identifies the main concepts, and groups related details under meaningful headings.",
    "For example, a database note could explain what an index does, show how it speeds up a lookup, and describe the cost of maintaining it during writes.",
    "The result should preserve important qualifications and separate established facts from assumptions.",
    "Generated notes can contain errors or omit context, so important claims should be checked against reliable sources.",
    "Key takeaways: provide context, use concrete examples, preserve caveats, and review the result before relying on it.",
    "The final note should be specific enough that a reader can understand the topic without needing to ask what the opening sentence meant.",
  ].join(" ");

  it("separates a valid title from the body", () => {
    expect(parseAiDraft("generate", "# AI Note Assistants\n\n" + completeBody, "AI note assistants")).toEqual({
      title: "AI Note Assistants",
      text: completeBody,
    });
  });

  it("rejects a teaser or truncated note", () => {
    expect(() => parseAiDraft(
      "generate",
      "# AI Note Assistants\n\nAI note-taking assistants leverage language models.",
      "AI note assistants",
    )).toThrow(/too short|incomplete/i);
  });

  it("requires the title to be the first line", () => {
    expect(() => parseAiDraft("generate", "Here is your note.\n\n# Topic\n\n" + completeBody, "Topic")).toThrow(/title and body/i);
  });

  it("accepts a deliberately brief but still complete note", () => {
    const body = "AI note assistants organize information into reusable notes. They can summarize text, explain concepts, and identify key points. For example, a lecture transcript can be converted into a short study guide. Always verify important claims because generated text can contain errors. Use the draft as a starting point and edit it to match your source.";
    expect(parseAiDraft("generate", "# AI Note Assistants\n\n" + body, "Write a brief note about AI note assistants").title).toBe("AI Note Assistants");
  });

  it("does not require a title for explain, improve, or summarize", () => {
    expect(parseAiDraft("explain", "An explanation long enough to be useful.", "")).toEqual({
      text: "An explanation long enough to be useful.",
    });
  });
});
