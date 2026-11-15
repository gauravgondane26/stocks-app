import { describe, expect, it } from "vitest";

import type { Quote } from "@/lib/market/types";
import { isFromToday, needsQuote, symbolsToPoll, toQuoteMessage } from "@/pipeline/worker/src/quotes";

describe("symbolsToPoll", () => {
  it("merges price alerts and watchlists into one sorted entry per stock", () => {
    const symbols = symbolsToPoll(
      "US",
      [
        { exchange: "NYSE", ticker: "KO", type: "above" },
        { exchange: "NASDAQ", ticker: "AAPL", type: "pct" },
        { exchange: "NASDAQ", ticker: "AAPL", type: "below" },
      ],
      [
        { exchange: "NASDAQ", ticker: "AAPL" },
        { exchange: "NYSE", ticker: "JPM" },
      ],
    );
    expect(symbols).toEqual([
      { market: "US", exchange: "NASDAQ", ticker: "AAPL" },
      { market: "US", exchange: "NYSE", ticker: "JPM" },
      { market: "US", exchange: "NYSE", ticker: "KO" },
    ]);
  });

  it("skips stocks whose only alerts are time or opening bell", () => {
    const symbols = symbolsToPoll(
      "IN",
      [
        { exchange: "NSE", ticker: "ITC", type: "time" },
        { exchange: "NSE", ticker: "TCS", type: "opening_bell" },
        { exchange: "NSE", ticker: "INFY", type: "target" },
      ],
      [],
    );
    expect(symbols.map(({ ticker }) => ticker)).toEqual(["INFY"]);
  });

  it("keeps the same ticker on two exchanges apart", () => {
    const symbols = symbolsToPoll("IN", [], [
      { exchange: "NSE", ticker: "RELIANCE" },
      { exchange: "BSE", ticker: "RELIANCE" },
    ]);
    expect(symbols).toHaveLength(2);
  });
});

describe("needsQuote", () => {
  it("is true for price rules only", () => {
    expect(["above", "below", "stop", "target", "pct"].every((t) => needsQuote(t as never))).toBe(true);
    expect(needsQuote("time")).toBe(false);
    expect(needsQuote("opening_bell")).toBe(false);
  });
});

describe("isFromToday", () => {
  // 2026-11-13 10:02 in New York, which is 20:32 in Kolkata.
  const now = new Date("2026-11-13T15:02:00Z");

  it("accepts a quote from earlier the same market day", () => {
    expect(isFromToday("US", Date.parse("2026-11-13T14:35:00Z"), now)).toBe(true);
  });

  it("rejects yesterday's close reported after the open", () => {
    expect(isFromToday("US", Date.parse("2026-11-12T21:00:00Z"), now)).toBe(false);
  });

  it("uses each market's own date", () => {
    // This instant is 2026-11-13 00:30 in Kolkata but still 2026-11-12 14:00 in New
    // York, and `now` is 2026-11-13 in both.
    const asOf = Date.parse("2026-11-12T19:00:00Z");
    expect(isFromToday("IN", asOf, now)).toBe(true);
    expect(isFromToday("US", asOf, now)).toBe(false);
  });
});

describe("toQuoteMessage", () => {
  it("copies the stock, prices and times from a provider quote", () => {
    const quote: Quote = {
      symbol: { market: "IN", exchange: "NSE", ticker: "RELIANCE" },
      price: 1339.7,
      previousClose: 1339.7,
      change: 0,
      changePercent: 0,
      dayHigh: null,
      dayLow: null,
      volume: null,
      currency: "INR",
      asOf: 1_763_027_400_000,
    };
    expect(toQuoteMessage(quote, 1_763_027_460_000, "live")).toEqual({
      market: "IN",
      exchange: "NSE",
      ticker: "RELIANCE",
      price: 1339.7,
      previousClose: 1339.7,
      asOf: 1_763_027_400_000,
      polledAt: 1_763_027_460_000,
      source: "live",
    });
  });
});
