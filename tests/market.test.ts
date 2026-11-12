import { describe, expect, it } from "vitest";

import { MARKET_CALENDARS } from "@/lib/market/holidays";
import {
  getMarketClock,
  hasHolidayData,
  holidayDataEnd,
  isMarketOpen,
  isTradingDay,
} from "@/lib/market/hours";
import { describeMarket, isMarketId, marketForCountry } from "@/lib/market/markets";
import { parseTicker, stockPath, symbolFromRoute, toTradingView, toYahoo } from "@/lib/market/symbols";
import { getSessionTimes } from "@/lib/trade/session";

const at = (iso: string) => new Date(iso);

describe("market hours", () => {
  it("opens New York at 09:30 and closes it at 16:00, exclusive", () => {
    expect(isMarketOpen("US", at("2026-11-11T09:29:00-05:00"))).toBe(false);
    expect(isMarketOpen("US", at("2026-11-11T09:30:00-05:00"))).toBe(true);
    expect(isMarketOpen("US", at("2026-11-11T15:59:00-05:00"))).toBe(true);
    expect(isMarketOpen("US", at("2026-11-11T16:00:00-05:00"))).toBe(false);
  });

  it("follows New York's clock across the end of daylight saving time", () => {
    // 09:30 EDT on Friday 2026-10-30 is 13:30 UTC; 09:30 EST on Monday 2026-11-02 is 14:30 UTC.
    expect(isMarketOpen("US", at("2026-10-30T13:30:00Z"))).toBe(true);
    expect(isMarketOpen("US", at("2026-11-02T13:30:00Z"))).toBe(false);
    expect(isMarketOpen("US", at("2026-11-02T14:30:00Z"))).toBe(true);
  });

  it("opens India at 09:15 and closes it at 15:30 IST", () => {
    expect(isMarketOpen("IN", at("2026-11-11T09:14:00+05:30"))).toBe(false);
    expect(isMarketOpen("IN", at("2026-11-11T09:15:00+05:30"))).toBe(true);
    expect(isMarketOpen("IN", at("2026-11-11T15:30:00+05:30"))).toBe(false);
  });

  it("is closed on weekends and holidays", () => {
    expect(isTradingDay("US", at("2026-11-14T12:00:00-05:00"))).toBe(false);
    expect(isTradingDay("US", at("2026-11-26T12:00:00-05:00"))).toBe(false); // Thanksgiving
    expect(isTradingDay("IN", at("2026-11-10T12:00:00+05:30"))).toBe(false); // Diwali-Balipratipada
    expect(isTradingDay("IN", at("2026-11-11T12:00:00+05:30"))).toBe(true);
  });

  it("closes early the day after Thanksgiving", () => {
    expect(isMarketOpen("US", at("2026-11-27T12:59:00-05:00"))).toBe(true);
    expect(isMarketOpen("US", at("2026-11-27T13:00:00-05:00"))).toBe(false);
    expect(getSessionTimes("US", "2026-11-27").close).toBe(13 * 60);
  });

  it("uses the market's own date near midnight", () => {
    // 20:00 UTC on 2026-11-11 is already 01:30 on 2026-11-12 in India.
    expect(getMarketClock("IN", at("2026-11-11T20:00:00Z"))).toEqual({ date: "2026-11-12", time: "01:30" });
    expect(getMarketClock("US", at("2026-11-11T20:00:00Z"))).toEqual({ date: "2026-11-11", time: "15:00" });
  });

  it("knows when a holiday calendar runs out", () => {
    expect(hasHolidayData("IN", at("2026-12-31T12:00:00+05:30"))).toBe(true);
    expect(hasHolidayData("IN", at("2027-01-01T12:00:00+05:30"))).toBe(false);
    expect(hasHolidayData("US", at("2028-12-31T12:00:00-05:00"))).toBe(true);
  });

  it("gives a calendar's last date once the market's own date passes it", () => {
    const end = MARKET_CALENDARS.IN.knownThrough;
    expect(holidayDataEnd("IN", at(`${end}T12:00:00+05:30`))).toBeNull();
    // 20:00 UTC on the last day is already the next day in India.
    expect(holidayDataEnd("IN", at(`${end}T20:00:00Z`))).toBe(end);
  });
});

describe("markets", () => {
  it("starts everyone outside India on the US market", () => {
    expect(marketForCountry("IN")).toBe("IN");
    expect(marketForCountry("GB")).toBe("US");
    expect(marketForCountry(undefined)).toBe("US");
  });

  it("recognises market ids only", () => {
    expect(isMarketId("US")).toBe(true);
    expect(isMarketId("us")).toBe(false);
    expect(isMarketId(null)).toBe(false);
  });

  it("describes a market for AI prompts", () => {
    expect(describeMarket("IN")).toBe("India (NSE and BSE, prices in INR)");
    expect(describeMarket("US")).toBe("US (NASDAQ, NYSE, and AMEX, prices in USD)");
  });
});

describe("symbol converters", () => {
  it("writes TradingView symbols, with BSE for Indian stocks", () => {
    expect(toTradingView({ market: "US", exchange: "NASDAQ", ticker: "AAPL" })).toBe("NASDAQ:AAPL");
    expect(toTradingView({ market: "US", exchange: "US", ticker: "AAPL" })).toBe("AAPL");
    expect(toTradingView({ market: "IN", exchange: "NSE", ticker: "RELIANCE" })).toBe("BSE:RELIANCE");
    expect(toTradingView({ market: "IN", exchange: "NSE", ticker: "M&M" })).toBe("BSE:M_M");
    expect(toTradingView({ market: "IN", exchange: "NSE", ticker: "BAJAJ-AUTO" })).toBe("BSE:BAJAJ_AUTO");
  });

  it("writes Yahoo symbols with suffixes and dashed share classes", () => {
    expect(toYahoo({ market: "US", exchange: "NYSE", ticker: "BRK.B" })).toBe("BRK-B");
    expect(toYahoo({ market: "US", exchange: "US", ticker: "AAPL" })).toBe("AAPL");
    expect(toYahoo({ market: "IN", exchange: "NSE", ticker: "RELIANCE" })).toBe("RELIANCE.NS");
    expect(toYahoo({ market: "IN", exchange: "BSE", ticker: "RELIANCE" })).toBe("RELIANCE.BO");
    expect(toYahoo({ market: "IN", exchange: "unknown", ticker: "ITC" })).toBe("ITC.NS");
  });

  it("parses tickers and refuses anything else", () => {
    expect(parseTicker(" m&m ")).toBe("M&M");
    expect(parseTicker("brk.b")).toBe("BRK.B");
    expect(parseTicker("AAPL;DROP")).toBeNull();
    expect(parseTicker("A".repeat(21))).toBeNull();
    expect(parseTicker(42)).toBeNull();
  });

  it("round-trips a ticker through the stock page URL", () => {
    const path = stockPath({ market: "IN", ticker: "M&M" });
    expect(path).toBe("/stocks/IN/M%26M");
    expect(symbolFromRoute("in", "M%26M")).toEqual({ market: "IN", exchange: "NSE", ticker: "M&M" });
  });

  it("returns null for a bad market or broken encoding", () => {
    expect(symbolFromRoute("xx", "AAPL")).toBeNull();
    expect(symbolFromRoute("US", "%E0%A4%A")).toBeNull();
  });
});
