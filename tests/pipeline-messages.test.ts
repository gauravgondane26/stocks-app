import { describe, expect, it } from "vitest";

import {
  encodeMessage,
  parseQuoteMessage,
  parseRingingMessage,
  quoteKey,
  type QuoteMessage,
  type RingingMessage,
} from "@/pipeline/worker/src/messages";
import { QUOTE_TOPICS, TOPIC_SPECS, quoteTopic } from "@/pipeline/worker/src/topics";

const quote: QuoteMessage = {
  market: "US",
  exchange: "NASDAQ",
  ticker: "AAPL",
  price: 360.16,
  previousClose: 354.9,
  asOf: 1_763_046_120_000,
  polledAt: 1_763_046_150_000,
  source: "live",
};

const ringing: RingingMessage = {
  alertId: "6734f0c2a1b2c3d4e5f60718",
  price: 360.16,
  message: "AAPL rose above $360.00",
  quoteAsOf: 1_763_046_120_000,
  source: "live",
};

const withQuote = (changes: Record<string, unknown>) =>
  JSON.stringify({ ...quote, ...changes });

describe("parseQuoteMessage", () => {
  it("round-trips an encoded quote", () => {
    expect(parseQuoteMessage(encodeMessage(quote))).toEqual({ ok: true, value: quote });
  });

  it("accepts a replay quote and a missing previous close", () => {
    const parsed = parseQuoteMessage(withQuote({ source: "replay", previousClose: null }));
    expect(parsed.ok && parsed.value).toMatchObject({ source: "replay", previousClose: null });
  });

  it("drops fields that aren't part of the message", () => {
    const parsed = parseQuoteMessage(withQuote({ extra: "ignored" }));
    expect(parsed.ok && Object.keys(parsed.value)).not.toContain("extra");
  });

  it.each([
    ["empty input", undefined],
    ["not JSON", "{not json"],
    ["a JSON array", "[1,2]"],
    ["an unknown market", withQuote({ market: "UK" })],
    ["no ticker", withQuote({ ticker: "" })],
    ["a blank exchange", withQuote({ exchange: "  " })],
    ["a zero price", withQuote({ price: 0 })],
    ["a price as text", withQuote({ price: "360.16" })],
    ["a negative previous close", withQuote({ previousClose: -1 })],
    ["a timestamp in seconds with a fraction", withQuote({ asOf: 1763046120.5 })],
    ["a missing polledAt", withQuote({ polledAt: undefined })],
    ["an unknown source", withQuote({ source: "backfill" })],
  ])("rejects %s", (_, raw) => {
    expect(parseQuoteMessage(raw).ok).toBe(false);
  });
});

describe("parseRingingMessage", () => {
  it("round-trips an encoded ring", () => {
    expect(parseRingingMessage(encodeMessage(ringing))).toEqual({ ok: true, value: ringing });
  });

  it("accepts a ring with no price or quote time", () => {
    const raw = JSON.stringify({ ...ringing, price: null, quoteAsOf: null });
    expect(parseRingingMessage(raw).ok).toBe(true);
  });

  it.each([
    ["an alert id that isn't an ObjectId", { alertId: "not-an-id" }],
    ["an empty message", { message: "" }],
    ["a text price", { price: "360" }],
    ["no source", { source: undefined }],
  ])("rejects %s", (_, changes) => {
    expect(parseRingingMessage(JSON.stringify({ ...ringing, ...changes })).ok).toBe(false);
  });
});

describe("keys and topics", () => {
  it("keys quotes by exchange and ticker, so one stock keeps one partition", () => {
    expect(quoteKey(quote)).toBe("NASDAQ:AAPL");
    expect(quoteKey({ exchange: "NSE", ticker: "M&M" })).toBe("NSE:M&M");
  });

  it("has one quote topic per market, all declared in TOPIC_SPECS", () => {
    expect(quoteTopic("US")).toBe("quotes.us");
    expect(quoteTopic("IN")).toBe("quotes.in");
    const declared = TOPIC_SPECS.map(({ name }) => name);
    for (const topic of Object.values(QUOTE_TOPICS)) expect(declared).toContain(topic);
    expect(new Set(declared).size).toBe(declared.length);
  });
});
