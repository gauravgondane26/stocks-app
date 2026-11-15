// Turns past 5-minute bars into a replay: one quote per bar close, grouped by time and
// spaced for a chosen speed. Pure: the runner (replay.ts) fetches the bars and sends.
import { getMarketClock } from "@/lib/market/hours";
import type { Bar, MarketId, StockSymbol } from "@/lib/market/types";

import type { QuoteMessage } from "./messages";

export const BAR_MS = 5 * 60 * 1000;

export type ReplayQuote = Omit<QuoteMessage, "polledAt">;

export type ReplayStep = {
  // When to send, in ms after the first step, at the chosen speed.
  offsetMs: number;
  quotes: ReplayQuote[];
};

export type ReplayPlan = {
  date: string;
  steps: ReplayStep[];
  quoteCount: number;
  // Stocks with no bars that day (not trading yet, suspended, or Yahoo had nothing).
  missing: string[];
  // How long the replay takes at the chosen speed.
  durationMs: number;
};

export type StockBars = { symbol: StockSymbol; bars: Bar[] };

const label = ({ exchange, ticker }: StockSymbol) => `${exchange}:${ticker}`;

const sessionDate = (market: MarketId, time: number) =>
  getMarketClock(market, new Date(time)).date;

// The trading days present in the bars, oldest first. Yahoo keeps 5-minute bars for
// 60 days, so these are the dates a replay can use.
export const sessionDates = (market: MarketId, stocks: StockBars[]): string[] =>
  [...new Set(stocks.flatMap(({ bars }) => bars.map(({ time }) => sessionDate(market, time))))].sort();

// The most recent session that has finished: the latest date before `today`, or
// today itself once the market has closed.
export const latestCompleteSession = (
  dates: string[],
  today: string,
  marketOpenNow: boolean,
): string | null => {
  const done = dates.filter((date) => date < today || (date === today && !marketOpenNow));
  return done.at(-1) ?? null;
};

// A bar's price is known at its close, so each quote is stamped with the bar's end.
// The previous close is the last bar of the session before `date`, which is what the
// percent-move rule compares against.
export const planReplay = (
  market: MarketId,
  date: string,
  stocks: StockBars[],
  speed: number,
): ReplayPlan => {
  if (!(speed > 0)) throw new Error("speed must be a positive number");

  const byTime = new Map<number, ReplayQuote[]>();
  const missing: string[] = [];

  for (const { symbol, bars } of stocks) {
    const sorted = [...bars].sort((a, b) => a.time - b.time);
    const session = sorted.filter(
      ({ time, close }) => sessionDate(market, time) === date && close > 0,
    );
    if (session.length === 0) {
      missing.push(label(symbol));
      continue;
    }

    const before = sorted.filter(({ time }) => sessionDate(market, time) < date).at(-1);
    const previousClose = before && before.close > 0 ? before.close : null;

    for (const bar of session) {
      const asOf = bar.time + BAR_MS;
      const quotes = byTime.get(asOf) ?? [];
      quotes.push({
        market,
        exchange: symbol.exchange,
        ticker: symbol.ticker,
        price: bar.close,
        previousClose,
        asOf,
        source: "replay",
      });
      byTime.set(asOf, quotes);
    }
  }

  const times = [...byTime.keys()].sort((a, b) => a - b);
  const first = times[0] ?? 0;
  const steps = times.map((time) => ({
    offsetMs: Math.round((time - first) / speed),
    quotes: byTime.get(time)!.sort((a, b) => a.ticker.localeCompare(b.ticker)),
  }));

  return {
    date,
    steps,
    quoteCount: steps.reduce((sum, { quotes }) => sum + quotes.length, 0),
    missing: missing.sort(),
    durationMs: steps.at(-1)?.offsetMs ?? 0,
  };
};

// "NSE:RELIANCE,NASDAQ:AAPL" -> symbols. Each entry needs its exchange, because the
// same ticker can trade on two (RELIANCE on NSE and BSE).
export const parseSymbolList = (market: MarketId, list: string): StockSymbol[] =>
  list
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [exchange, ticker, extra] = item.split(":");
      if (!exchange || !ticker || extra !== undefined) {
        throw new Error(`"${item}" should look like EXCHANGE:TICKER, for example NSE:RELIANCE`);
      }
      return { market, exchange: exchange.toUpperCase(), ticker: ticker.toUpperCase() };
    });
