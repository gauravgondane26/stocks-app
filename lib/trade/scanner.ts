// Ported from trader-scanner/scan.py in Jakeschincariol/day-trader-skill.
// MIT License, Copyright (c) 2026 Jake Schincariol. Full text in lib/trade/LICENSE.
// The skill scans every US-listed stock and filters by price and volume. Here the
// list is bounded (an index plus watchlists), so those liquidity filters are left out.
// One addition: the breakout scan also returns stocks whose spark data has gaps (see
// findOrbCandidates), which the original drops. Pure: no database or network.

import { getMarketClock, isTradingDay } from "@/lib/market/hours";
import type { Bar, CloseSeries, MarketId } from "@/lib/market/types";
import { getSessionTimes, toHHMM, toMinutes } from "@/lib/trade/session";

const BAR_MINUTES = 5;
const BAR_MS = BAR_MINUTES * 60_000;
const MIN_DAILY_BARS = 30;

export const DAILY_SETUPS = {
  breakout_20d: "20-day closing-high breakout",
  bull_flag: "Bull flag",
  reclaim_ma20: "Reclaimed the 20-day average",
  oversold: "Oversold (RSI under 30)",
  oversold_bounce: "Oversold bounce",
} as const;
export type DailySetup = keyof typeof DAILY_SETUPS;

export type ScanSymbol = { ticker: string; name: string };

export type DailyHit = {
  ticker: string;
  name: string;
  setups: DailySetup[];
  price: number;
  closeDate: string;
  rsi: number | null;
  volume: number | null;
};

export type OrbHit = {
  ticker: string;
  name: string;
  // The trigger bar's close time, "HH:MM" market time.
  at: string;
  barStart: string;
  price: number;
  orHigh: number;
  orLow: number;
  pctOver: number;
};

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor + 0;
};

// Wilder's RSI on closes.
export const rsi = (closes: number[], periods = 14): number | null => {
  if (closes.length < periods + 1) return null;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    gains.push(Math.max(0, closes[i] - closes[i - 1]));
    losses.push(Math.max(0, closes[i - 1] - closes[i]));
  }
  let averageGain = gains.slice(0, periods).reduce((a, b) => a + b, 0) / periods;
  let averageLoss = losses.slice(0, periods).reduce((a, b) => a + b, 0) / periods;
  for (let i = periods; i < gains.length; i += 1) {
    averageGain = (averageGain * (periods - 1) + gains[i]) / periods;
    averageLoss = (averageLoss * (periods - 1) + losses[i]) / periods;
  }
  return averageLoss ? 100 - 100 / (1 + averageGain / averageLoss) : 100;
};

// The rules work on daily closes only, as the original's do.
export const findSetups = (closes: number[]): { setups: DailySetup[]; rsi: number | null } => {
  const c = closes;
  const last = c.at(-1)!;
  const high20 = Math.max(...c.slice(-21, -1));
  const ma20 = c.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const ma20Previous = c.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const run = c.at(-6)! / c.at(-16)! - 1;
  const range5 = (Math.max(...c.slice(-5)) - Math.min(...c.slice(-5))) / last;
  const rsiNow = rsi(c);
  const rsiPrevious = rsi(c.slice(0, -1));

  const setups: DailySetup[] = [];
  if (last > high20) setups.push("breakout_20d");
  if (run > 0.1 && range5 < 0.05) setups.push("bull_flag");
  if (c.at(-2)! < ma20Previous && last > ma20) setups.push("reclaim_ma20");
  if (rsiNow !== null && rsiNow < 30) setups.push("oversold");
  if (rsiPrevious !== null && rsiPrevious < 30 && last > c.at(-2)!) setups.push("oversold_bounce");
  return { setups, rsi: rsiNow };
};

// Complete daily closes, one a day. Today's bar is left out until the session closes.
const dailyCloses = (points: CloseSeries["points"], market: MarketId, now: Date) => {
  const today = getMarketClock(market, now);
  const todayDone =
    !isTradingDay(market, now) ||
    toMinutes(today.time) >= getSessionTimes(market, today.date).close;

  const byDate = new Map<string, number>();
  for (const { time, close } of points) {
    const { date } = getMarketClock(market, new Date(time));
    if (date > today.date || (date === today.date && !todayDone)) continue;
    byDate.set(date, close);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
};

export const scanDaily = (
  series: Record<string, CloseSeries>,
  symbols: ScanSymbol[],
  { market, now }: { market: MarketId; now: Date },
) => {
  const counts = { requested: symbols.length, fetched: 0, short: 0, scanned: 0, hits: 0 };
  const hits: DailyHit[] = [];
  const dates = new Map<string, number>();

  for (const { ticker, name } of symbols) {
    const data = series[ticker];
    if (!data) continue;
    counts.fetched += 1;
    const bars = dailyCloses(data.points, market, now);
    if (bars.length < MIN_DAILY_BARS) {
      counts.short += 1;
      continue;
    }
    counts.scanned += 1;
    const closeDate = bars.at(-1)![0];
    dates.set(closeDate, (dates.get(closeDate) ?? 0) + 1);

    const closes = bars.map(([, close]) => close);
    const { setups, rsi: rsiNow } = findSetups(closes);
    if (setups.length === 0) continue;
    hits.push({
      ticker,
      name,
      setups,
      price: round(closes.at(-1)!, 2),
      closeDate,
      rsi: rsiNow === null ? null : round(rsiNow, 1),
      volume: data.volume,
    });
  }

  // Most money traded first.
  hits.sort(
    (a, b) =>
      b.price * (b.volume ?? 0) - a.price * (a.volume ?? 0) || a.ticker.localeCompare(b.ticker),
  );
  counts.hits = hits.length;
  const closeDate =
    [...dates.entries()].sort(([da, na], [db, nb]) => nb - na || db.localeCompare(da))[0]?.[0] ?? null;
  return { hits, counts, closeDate };
};

// ---------------------------------------------------------------- opening-range breakout

export type OrbWindow =
  | { ok: true; date: string; cutoff: number; rangeBars: number }
  | { ok: false; reason: string };

export const orbWindow = (
  market: MarketId,
  now: Date,
  { orMinutes = 15, noEntriesAfter }: { orMinutes?: number; noEntriesAfter: string },
): OrbWindow => {
  const { date, time } = getMarketClock(market, now);
  if (!isTradingDay(market, now)) {
    return { ok: false, reason: "the market is closed today" };
  }
  const session = getSessionTimes(market, date);
  const cutoff = toMinutes(time);
  const firstClose = session.open + orMinutes + BAR_MINUTES;
  if (cutoff >= session.close) {
    return { ok: false, reason: `the market closed at ${toHHMM(session.close)}` };
  }
  if (cutoff < firstClose) {
    return {
      ok: false,
      reason: `the first bar after the ${orMinutes}-minute opening range closes at ${toHHMM(firstClose)}, so run it after then`,
    };
  }
  if (cutoff > toMinutes(noEntriesAfter)) {
    return {
      ok: false,
      reason: `it's after ${noEntriesAfter}, the last time for new entries, so any breakout found now has expired`,
    };
  }
  return { ok: true, date, cutoff, rangeBars: orMinutes / BAR_MINUTES };
};

type SessionPoint = { start: number; close: number; high: number | null; low: number | null };

// The day's 5-minute bars that are complete at the cutoff, on the grid, one a slot.
const sessionPoints = (
  points: { time: number; close: number; high?: number; low?: number }[],
  market: MarketId,
  window: Extract<OrbWindow, { ok: true }>,
): SessionPoint[] => {
  const session = getSessionTimes(market, window.date);
  const bySlot = new Map<number, SessionPoint>();
  for (const point of points) {
    if (point.time % BAR_MS !== 0) continue;
    const { date, time } = getMarketClock(market, new Date(point.time));
    const start = toMinutes(time);
    if (date !== window.date || start < session.open || start >= session.close) continue;
    if (start + BAR_MINUTES > window.cutoff) continue;
    bySlot.set(start, {
      start,
      close: point.close,
      high: point.high ?? null,
      low: point.low ?? null,
    });
  }
  return [...bySlot.values()].sort((a, b) => a.start - b.start);
};

// Every slot from the open to the cutoff is there: a gap means a halt or a thin stock.
const isUsable = (
  bars: SessionPoint[],
  market: MarketId,
  window: Extract<OrbWindow, { ok: true }>,
) => {
  const session = getSessionTimes(market, window.date);
  const wanted = Math.floor((Math.min(window.cutoff, session.close) - session.open) / BAR_MINUTES);
  return (
    wanted >= window.rangeBars &&
    bars.length === wanted &&
    bars.every((bar, index) => bar.start === session.open + index * BAR_MINUTES)
  );
};

// First pass, closes only: some bar after the range closed at or above the range's
// highest close. Every real breakout passes this, since the range high is at least that.
export const findOrbCandidates = (
  series: Record<string, CloseSeries>,
  symbols: ScanSymbol[],
  { market, window }: { market: MarketId; window: Extract<OrbWindow, { ok: true }> },
) => {
  const counts = { requested: symbols.length, fetched: 0, unusable: 0, scanned: 0, candidates: 0 };
  const candidates: (ScanSymbol & { traded: number })[] = [];
  const gapped: (ScanSymbol & { traded: number })[] = [];

  for (const symbol of symbols) {
    const data = series[symbol.ticker];
    if (!data) continue;
    counts.fetched += 1;
    const bars = sessionPoints(data.points, market, window);
    if (!isUsable(bars, market, window)) {
      counts.unusable += 1;
      // Not in the skill. Yahoo's spark endpoint drops single 5-minute bars at random,
      // even for busy stocks, while its chart endpoint has them. Stocks with some bars
      // are returned separately so the caller can check them with a full chart.
      if (bars.length > 0) {
        gapped.push({ ...symbol, traded: bars.at(-1)!.close * (data.volume ?? 0) });
      }
      continue;
    }
    counts.scanned += 1;
    const top = Math.max(...bars.slice(0, window.rangeBars).map(({ close }) => close));
    if (bars.slice(window.rangeBars).some(({ close }) => close >= top)) {
      candidates.push({ ...symbol, traded: bars.at(-1)!.close * (data.volume ?? 0) });
    }
  }

  candidates.sort((a, b) => b.traded - a.traded);
  gapped.sort((a, b) => b.traded - a.traded);
  counts.candidates = candidates.length;
  return { candidates, gapped, counts };
};

// Second pass, real highs and lows: the first bar to CLOSE above the range high.
export const confirmOrbHit = (
  bars: Bar[],
  symbol: ScanSymbol,
  { market, window }: { market: MarketId; window: Extract<OrbWindow, { ok: true }> },
): OrbHit | null | "unusable" => {
  const points = sessionPoints(bars, market, window);
  if (!isUsable(points, market, window)) return "unusable";

  const range = points.slice(0, window.rangeBars);
  if (range.some(({ high, low }) => high === null || low === null)) return "unusable";
  const orHigh = Math.max(...range.map(({ high }) => high!));
  const orLow = Math.min(...range.map(({ low }) => low!));

  const trigger = points.slice(window.rangeBars).find(({ close }) => close > orHigh);
  if (!trigger) return null;
  return {
    ticker: symbol.ticker,
    name: symbol.name,
    at: toHHMM(trigger.start + BAR_MINUTES),
    barStart: toHHMM(trigger.start),
    price: round(trigger.close, 2),
    orHigh: round(orHigh, 2),
    orLow: round(orLow, 2),
    pctOver: round((trigger.close / orHigh - 1) * 100, 2),
  };
};
