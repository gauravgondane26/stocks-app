import { describe, expect, it } from "vitest";

import type { Bar, StockSymbol } from "@/lib/market/types";
import {
  BAR_MS,
  latestCompleteSession,
  parseSymbolList,
  planReplay,
  sessionDates,
} from "@/pipeline/worker/src/replay-plan";

const itc: StockSymbol = { market: "IN", exchange: "NSE", ticker: "ITC" };
const tcs: StockSymbol = { market: "IN", exchange: "NSE", ticker: "TCS" };

// 09:15 IST on a date, as a UTC epoch.
const ist = (date: string, time: string) => Date.parse(`${date}T${time}:00+05:30`);

const bar = (time: number, close: number): Bar => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1000,
});

const itcBars = [
  bar(ist("2026-11-11", "15:10"), 404),
  bar(ist("2026-11-11", "15:15"), 405), // previous session's last bar
  bar(ist("2026-11-12", "09:15"), 406),
  bar(ist("2026-11-12", "09:20"), 407),
  bar(ist("2026-11-12", "09:25"), 408),
];

const tcsBars = [
  bar(ist("2026-11-11", "15:15"), 3000),
  bar(ist("2026-11-12", "09:20"), 3010), // no 09:15 bar
  bar(ist("2026-11-12", "09:25"), 3020),
];

describe("planReplay", () => {
  const plan = planReplay("IN", "2026-11-12", [
    { symbol: itc, bars: itcBars },
    { symbol: tcs, bars: tcsBars },
  ], 60);

  it("makes one replay quote per bar, stamped at the bar's close", () => {
    expect(plan.quoteCount).toBe(5);
    const first = plan.steps[0].quotes[0];
    expect(first).toEqual({
      market: "IN",
      exchange: "NSE",
      ticker: "ITC",
      price: 406,
      previousClose: 405,
      asOf: ist("2026-11-12", "09:15") + BAR_MS,
      source: "replay",
    });
  });

  it("uses the previous session's last bar as each stock's previous close", () => {
    const tcsQuotes = plan.steps.flatMap(({ quotes }) => quotes).filter(({ ticker }) => ticker === "TCS");
    expect(tcsQuotes.map(({ previousClose }) => previousClose)).toEqual([3000, 3000]);
  });

  it("groups stocks by bar time and spaces the steps for the speed", () => {
    expect(plan.steps.map(({ quotes }) => quotes.map(({ ticker }) => ticker))).toEqual([
      ["ITC"],
      ["ITC", "TCS"],
      ["ITC", "TCS"],
    ]);
    // 5 minutes at 60x is 5 seconds.
    expect(plan.steps.map(({ offsetMs }) => offsetMs)).toEqual([0, 5000, 10000]);
    expect(plan.durationMs).toBe(10000);
  });

  it("lists stocks with no bars that day and leaves a missing previous close empty", () => {
    const fresh = planReplay("IN", "2026-11-12", [
      { symbol: itc, bars: [bar(ist("2026-11-12", "09:15"), 406)] },
      { symbol: tcs, bars: [bar(ist("2026-11-11", "15:15"), 3000)] },
    ], 60);
    expect(fresh.missing).toEqual(["NSE:TCS"]);
    expect(fresh.steps[0].quotes[0].previousClose).toBeNull();
  });

  it("skips bars with no price", () => {
    const withEmpty = planReplay("IN", "2026-11-12", [
      { symbol: itc, bars: [...itcBars, bar(ist("2026-11-12", "09:30"), 0)] },
    ], 60);
    expect(withEmpty.quoteCount).toBe(3);
  });

  it("rejects a speed that isn't positive", () => {
    expect(() => planReplay("IN", "2026-11-12", [], 0)).toThrow("speed");
  });
});

describe("session dates", () => {
  it("lists the trading days in the bars, oldest first", () => {
    expect(sessionDates("IN", [{ symbol: itc, bars: itcBars }, { symbol: tcs, bars: tcsBars }])).toEqual([
      "2026-11-11",
      "2026-11-12",
    ]);
  });

  it("dates a bar in the market's own time zone", () => {
    // 2026-11-12 20:00 in New York is 2026-11-13 01:00 UTC.
    expect(sessionDates("US", [{ symbol: itc, bars: [bar(Date.parse("2026-11-13T01:00:00Z"), 1)] }])).toEqual([
      "2026-11-12",
    ]);
  });

  it("picks the latest finished session", () => {
    const dates = ["2026-11-11", "2026-11-12", "2026-11-13"];
    expect(latestCompleteSession(dates, "2026-11-13", true)).toBe("2026-11-12");
    expect(latestCompleteSession(dates, "2026-11-13", false)).toBe("2026-11-13");
    expect(latestCompleteSession(dates, "2026-11-15", false)).toBe("2026-11-13");
    expect(latestCompleteSession([], "2026-11-15", false)).toBeNull();
  });
});

describe("parseSymbolList", () => {
  it("reads EXCHANGE:TICKER entries", () => {
    expect(parseSymbolList("IN", "nse:itc, BSE:RELIANCE,NSE:M&M")).toEqual([
      { market: "IN", exchange: "NSE", ticker: "ITC" },
      { market: "IN", exchange: "BSE", ticker: "RELIANCE" },
      { market: "IN", exchange: "NSE", ticker: "M&M" },
    ]);
  });

  it.each(["ITC", "NSE:", ":ITC", "NSE:ITC:X"])("rejects %s", (entry) => {
    expect(() => parseSymbolList("IN", entry)).toThrow("EXCHANGE:TICKER");
  });
});
