export type AiAction = "explain" | "improve" | "summarize" | "generate";

export type ParsedAiDraft = {
  text: string;
  title?: string;
};

export type GroqOutput = {
  text: string;
  complete: boolean;
  finishReason?: string;
};

export function readGeminiOutput(payload: Record<string, unknown>): string {
  if (!Array.isArray(payload.steps)) return "";

  const pieces: string[] = [];
  for (const step of payload.steps) {
    if (!step || typeof step !== "object" || !("type" in step) || step.type !== "model_output") continue;
    if (!("content" in step) || !Array.isArray(step.content)) continue;

    for (const part of step.content) {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        pieces.push(part.text);
      }
    }
  }
  let combined = "";
  for (const piece of pieces) {
    if (!combined) combined = piece;
    else if (/^\s/.test(piece) || /\s$/.test(combined)) combined += piece;
    else combined += "\n" + piece;
  }
  return combined.trim();
}

export function readGroqOutput(payload: Record<string, unknown>): GroqOutput {
  if (!Array.isArray(payload.choices) || !payload.choices[0] || typeof payload.choices[0] !== "object") {
    return { text: "", complete: false };
  }

  const choice = payload.choices[0] as Record<string, unknown>;
  const message = choice.message;
  const text = message && typeof message === "object" && "content" in message &&
      typeof message.content === "string"
    ? message.content.trim()
    : "";
  const finishReason = typeof choice.finish_reason === "string" ? choice.finish_reason : undefined;

  return {
    text,
    finishReason,
    complete: finishReason === "stop" && text.length > 0,
  };
}

function stripOuterCodeFence(value: string): string {
  const fence = String.fromCharCode(96).repeat(3);
  const withoutOpeningFence = value.trim().replace(
    new RegExp("^" + fence + "(?:markdown|md)?\\s*\\r?\\n", "i"),
    "",
  );
  return withoutOpeningFence
    .replace(new RegExp("\\r?\\n" + fence + "\\s*$"), "")
    .trim();
}

export function parseAiDraft(action: AiAction, rawText: string, prompt: string): ParsedAiDraft {
  const text = stripOuterCodeFence(rawText);
  if (!text) throw new Error("The provider returned an empty response.");

  if (action !== "generate") {
    if (text.length < 12) throw new Error("The provider returned an incomplete response.");
    return { text };
  }

  const match = text.match(/^#\s+([^\r\n]+)\s*\r?\n+([\s\S]+)$/);
  if (!match) {
    throw new Error("The generated note did not include the required title and body.");
  }

  const title = match[1].trim().replace(/\s+#+\s*$/, "");
  const body = match[2].trim();
  const wordCount = body ? body.split(/\s+/).filter(Boolean).length : 0;
  const explicitlyBrief = /\b(brief|briefly|short|quick|concise|one paragraph)\b/i.test(prompt);
  const minimumWords = explicitlyBrief ? 30 : 80;
  const minimumCharacters = explicitlyBrief ? 120 : 300;

  if (title.length < 4 || title.length > 100 || body.length < minimumCharacters || wordCount < minimumWords) {
    throw new Error("The generated note was too short to be considered complete.");
  }

  return { title, text: body };
}
