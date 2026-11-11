import "server-only";

// The one place that talks to an AI provider, so swapping providers means editing
// only this file. Callers always have a plain-text fallback, so a failure here is
// a normal result, never a thrown error.

const RESPONSES_URL = "https://api.openai.com/v1/responses";

// Checked 2026-11-11: OpenAI's cheapest current text model, and available to this
// project's key. It is a reasoning model, so effort stays low and the output limit
// leaves room for reasoning tokens. A welcome intro costs about $0.00005.
const MODEL = "gpt-6-luna";
const REASONING_EFFORT = "low";
const TIMEOUT_MS = 30_000;

export type AiResult = { ok: true; text: string } | { ok: false; reason: string };

type ResponsesBody = {
  status?: string;
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
  output?: { type: string; content?: { type: string; text?: string }[] }[];
};

export const generateText = async ({
  instructions,
  input,
  maxOutputTokens = 600,
}: {
  instructions: string;
  input: string;
  maxOutputTokens?: number;
}): Promise<AiResult> => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, reason: "OPENAI_API_KEY is not set" };

  try {
    const response = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: REASONING_EFFORT },
        // Nothing here needs to be kept on OpenAI's side.
        store: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await response.json()) as ResponsesBody;
    if (!response.ok) {
      return { ok: false, reason: `OpenAI ${response.status}: ${body.error?.message ?? "error"}` };
    }
    if (body.status !== "completed") {
      return {
        ok: false,
        reason: `OpenAI response ${body.status ?? "unknown"}${
          body.incomplete_details?.reason ? ` (${body.incomplete_details.reason})` : ""
        }`,
      };
    }

    // The raw API has no output_text field (that is an SDK helper), so join the
    // text parts of the message items.
    const text = (body.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text" && part.text)
      .map((part) => part.text)
      .join("")
      .trim();
    return text ? { ok: true, text } : { ok: false, reason: "OpenAI returned no text" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? `OpenAI request failed: ${error.message}` : "OpenAI request failed",
    };
  }
};
