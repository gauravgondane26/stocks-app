import "server-only";

// The one place that talks to an AI provider, so swapping providers means editing
// only this file. Callers always have a plain-text fallback, so a failure here is
// a normal result, never a thrown error.

const RESPONSES_URL = "https://api.openai.com/v1/responses";

// Tried in order until one answers (owner's choice, 2026-11-11). Both are reasoning
// models, and each needs its own lowest effort: gpt-5-nano at "low" spent 192
// reasoning tokens on a welcome intro and cost more than gpt-6-luna.
// - gpt-5-nano: cheapest ($0.05 / $0.40 per 1M tokens, ~$0.00004 an intro), but
//   OpenAI lists it as deprecated, so it may stop working.
// - gpt-6-luna: OpenAI's cheapest current model ($0.10 / $0.50, ~$0.00005 an
//   intro). It doesn't accept "minimal".
export type AiModel = { id: string; effort: string };
const MODELS: readonly AiModel[] = [
  { id: "gpt-5-nano", effort: "minimal" },
  { id: "gpt-6-luna", effort: "low" },
];
const TIMEOUT_MS = 30_000;

export type AiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: string };

type ResponsesBody = {
  status?: string;
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
  output?: { type: string; content?: { type: string; text?: string }[] }[];
};

type Request = { instructions: string; input: string; maxOutputTokens: number };

// Any failure moves on to the next model, and so does text the caller's `accept`
// check rejects, since cheaper models break instructions more often. The reasons
// are joined if every model fails. `models` is only overridden by tests.
export const generateText = async ({
  instructions,
  input,
  maxOutputTokens = 600,
  accept = () => true,
  models = MODELS,
}: {
  instructions: string;
  input: string;
  maxOutputTokens?: number;
  accept?: (text: string) => boolean;
  models?: readonly AiModel[];
}): Promise<AiResult> => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, reason: "OPENAI_API_KEY is not set" };

  const reasons: string[] = [];
  for (const model of models) {
    const result = await askModel(key, model, { instructions, input, maxOutputTokens });
    if (result.ok && accept(result.text)) {
      if (reasons.length > 0) console.warn(`AI fell back to ${model.id}:`, reasons.join("; "));
      return result;
    }
    reasons.push(`${model.id}: ${result.ok ? "text failed the caller's checks" : result.reason}`);
  }
  return { ok: false, reason: reasons.join("; ") };
};

const askModel = async (
  key: string,
  model: AiModel,
  { instructions, input, maxOutputTokens }: Request,
): Promise<AiResult> => {
  try {
    const response = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: model.effort },
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
    return text ? { ok: true, text, model: model.id } : { ok: false, reason: "OpenAI returned no text" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? `OpenAI request failed: ${error.message}` : "OpenAI request failed",
    };
  }
};
