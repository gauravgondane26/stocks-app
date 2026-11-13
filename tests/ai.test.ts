import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { claimsLivePrices, cleanAiText, givesAdvice } from "@/lib/ai/checks";
import { generateText } from "@/lib/ai/index";
import { isUsableSummary } from "@/lib/digest";
import { fallbackIntro, isUsableIntro } from "@/lib/welcome";

describe("text checks", () => {
  it.each([
    ["You can monitor real-time quotes from NSE and BSE.", false],
    ["Track live prices on your watchlist.", false],
    ["Get realtime alerts.", false],
    ["Set alerts and follow delayed prices for the stocks you care about.", true],
    ["You can deliver a lively plan for your trades.", true],
    ["All prices shown are delayed, never real-time or live, and it never places orders.", true],
    ["Prices are in USD and delayed—not real-time or live—and OpenWatch never places orders.", true],
    ["Prices are delayed and not real-time.", true],
    ["Prices aren't live, so plan with care.", true],
    ["Prices are delayed, but alerts arrive in real time.", false],
    ["Not delayed: you get real-time quotes.", false],
    ["", false],
    ["x".repeat(601), false],
  ])("welcome intro %j usable: %s", (text, usable) => {
    expect(isUsableIntro(text)).toBe(usable);
  });

  it("spots advice but not a reported question", () => {
    expect(givesAdvice("You should buy Infosys before results.")).toBe(true);
    expect(givesAdvice("HDFC Bank will rise next week.")).toBe(true);
    expect(givesAdvice("Business Today asked what investors should do after the rally.")).toBe(false);
  });

  it("checks digest summaries for length, live prices and advice", () => {
    expect(isUsableSummary("x".repeat(901))).toBe(false);
    expect(isUsableSummary("Follow live prices for Reliance.")).toBe(false);
    expect(isUsableSummary("HDFC Bank was in the news after its shares hit a three-month high.")).toBe(true);
  });

  it("cleans markdown bold and extra spaces", () => {
    expect(cleanAiText("  **Apple**   was\n in the news ")).toBe("Apple was in the news");
    expect(claimsLivePrices(cleanAiText("**Live** prices"))).toBe(true);
  });

  it("writes a fallback intro for the user's market that passes the same checks", () => {
    const intro = fallbackIntro("IN");
    expect(intro).toContain("India market");
    expect(isUsableIntro(intro)).toBe(true);
  });
});

describe("generateText", () => {
  const models = [
    { id: "first-model", effort: "minimal" },
    { id: "second-model", effort: "low" },
  ];
  const reply = (text: string) => ({
    status: "completed",
    output: [
      { type: "reasoning", content: [] },
      { type: "message", content: [{ type: "output_text", text }] },
    ],
  });
  const respond = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  const fetchMock = vi.fn<typeof fetch>();
  const requestedModels = () =>
    fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as { model: string; reasoning: { effort: string }; store: boolean });

  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fails without calling OpenAI when there is no key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await generateText({ instructions: "x", input: "y", models });
    expect(result).toEqual({ ok: false, reason: "OPENAI_API_KEY is not set" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the first model's message text, sent with its effort and store off", async () => {
    fetchMock.mockImplementationOnce(() => respond(200, reply("Hello there.")));
    const result = await generateText({ instructions: "x", input: "y", models });
    expect(result).toEqual({ ok: true, text: "Hello there.", model: "first-model" });
    expect(requestedModels()).toEqual([
      expect.objectContaining({ model: "first-model", reasoning: { effort: "minimal" }, store: false }),
    ]);
  });

  it("falls back to the next model on an API error", async () => {
    fetchMock
      .mockImplementationOnce(() => respond(400, { error: { message: "Unsupported value" } }))
      .mockImplementationOnce(() => respond(200, reply("From the second.")));
    const result = await generateText({ instructions: "x", input: "y", models });
    expect(result).toEqual({ ok: true, text: "From the second.", model: "second-model" });
  });

  it("falls back when the caller's check rejects the text", async () => {
    fetchMock
      .mockImplementationOnce(() => respond(200, reply("Live prices!")))
      .mockImplementationOnce(() => respond(200, reply("Delayed prices.")));
    const result = await generateText({ instructions: "x", input: "y", models, accept: (text) => !claimsLivePrices(text) });
    expect(result).toMatchObject({ ok: true, model: "second-model" });
  });

  it("returns every reason when all models fail, without throwing", async () => {
    fetchMock
      .mockImplementationOnce(() => respond(200, { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }))
      .mockImplementationOnce(() => Promise.reject(new Error("network down")));
    const result = await generateText({ instructions: "x", input: "y", models });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe(
      "first-model: OpenAI response incomplete (max_output_tokens); second-model: OpenAI request failed: network down",
    );
  });
});
