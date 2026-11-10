// Ported from trader-timemachine/timemachine.py in Jakeschincariol/day-trader-skill.
// MIT License, Copyright (c) 2026 Jake Schincariol. Full text in lib/trade/LICENSE.
//
// Replays the rest of a planned long trade's session thousands of times from the
// stock's own recent 5-minute bars, then runs the same rule on every real past
// session. The random draws use a seeded generator, so a seed always gives the same
// numbers here, but not the same numbers as the original's Python generator. The
// history replay has no randomness and matches the original exactly.
// Pure: no database or network.

import { getMarketClock } from "@/lib/market/hours";
import type { Bar, MarketId } from "@/lib/market/types";
import { getSessionTimes, toHHMM, toMinutes } from "@/lib/trade/session";

const BAR_MINUTES = 5;
const BAR_MS = BAR_MINUTES * 60_000;
const MIN_SESSIONS = 20;
const BAND_PATHS = 2000;
const BAND_QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95] as const;
// Verdict thresholds, in shares of the replays that hit one side.
const COIN_FLIP = 0.05;
const STRONG = 0.15;
const MANY_NEITHER = 0.4;

export const DEFAULT_SEED = 19;
export const DEFAULT_REPLAYS = 10_000;
const DEFAULT_WINDOW = 2;

type Ratios = readonly [open: number, high: number, low: number, close: number];
type DayBar = { open: number; high: number; low: number; close: number };
type Session = { date: string; bars: DayBar[] };

export type HistoryStopRule = "or_mid" | "or_low" | "pct";

export type TimeMachinePlan = {
  date: string;
  entry: number;
  stop: number;
  target: number;
  // The entry bar's slot: 0 is the first bar of the session.
  entryBar: number;
  stopRule: HistoryStopRule;
  orMinutes: number;
};

export type TimeMachineResult = {
  seed: number;
  replays: number;
  until: string;
  barsLeft: number;
  pTarget: number;
  pStop: number;
  pNeither: number;
  pGreen: number;
  medianClose: number;
  p5Close: number;
  p95Close: number;
  avgR: number;
  rAtTarget: number;
  // Percentile bands of the price after each bar: 5th, 25th, 50th, 75th, 95th.
  bands: number[][];
  bandTimes: string[];
  pool: { sessions: number; from: string; to: string };
  history: {
    sessions: number;
    triggered: number;
    target: number;
    stop: number;
    neither: number;
    avgR: number | null;
    stopRule: HistoryStopRule;
  };
  verdict: string;
  notes: string[];
  warnings: string[];
};

export type TimeMachineOutcome =
  | { ok: true; result: TimeMachineResult }
  | { ok: false; reason: string };

// A small seeded generator (mulberry32). Same seed, same sequence, on any machine.
const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const percentile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor + 0;
};
const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
// A long's stop rounds down to the cent, away from the entry.
const centsDown = (value: number) => Math.floor(round(value * 100, 4)) / 100;

const clock12 = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${((hours + 11) % 12) + 1}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
};

// Complete, on-grid, regular-session bars grouped by market date.
const splitSessions = (
  bars: Bar[],
  market: MarketId,
  now: Date,
  open: number,
  sessionBars: number,
) => {
  const days = new Map<string, Map<number, DayBar>>();
  for (const bar of bars) {
    // Yahoo's live tick is off the 5-minute grid, and an unfinished bar isn't used.
    if (bar.time % BAR_MS !== 0 || bar.time + BAR_MS > now.getTime()) continue;
    const { date, time } = getMarketClock(market, new Date(bar.time));
    const sinceOpen = toMinutes(time) - open;
    if (sinceOpen < 0 || sinceOpen >= sessionBars * BAR_MINUTES) continue;

    let day = days.get(date);
    if (!day) days.set(date, (day = new Map()));
    day.set(sinceOpen / BAR_MINUTES, bar);
  }
  return days;
};

// pool[i] holds every past session's bar i as ratios to bar i-1's close, up to the
// last bar the replays use.
const buildPool = (sessions: Session[], lastBar: number) => {
  const pool: Ratios[][] = Array.from({ length: lastBar + 1 }, () => []);
  for (const { bars } of sessions) {
    for (let i = 1; i <= lastBar; i += 1) {
      const previous = bars[i - 1].close;
      const bar = bars[i];
      pool[i].push([
        bar.open / previous,
        bar.high / previous,
        bar.low / previous,
        bar.close / previous,
      ]);
    }
  }
  return pool;
};

const simulate = ({
  pool,
  entry,
  stop,
  target,
  entryBar,
  lastBar,
  replays,
  seed,
  window,
}: {
  pool: Ratios[][];
  entry: number;
  stop: number;
  target: number;
  entryBar: number;
  lastBar: number;
  replays: number;
  seed: number;
  window: number;
}) => {
  const risk = entry - stop;
  const rAtTarget = round((target - entry) / risk, 4);

  const run = (paths: number, onPath: (closes: number[], outcome: string) => void) => {
    const random = seededRandom(seed);
    // A nearby time of day, kept inside the replay's own window. Replaying to the
    // close, that is the whole session, as in the original.
    const pickSlot = (bar: number) =>
      window === 0
        ? bar
        : Math.min(
            lastBar,
            Math.max(1, bar + Math.floor(random() * (2 * window + 1)) - window),
          );

    for (let n = 0; n < paths; n += 1) {
      let price = entry;
      let outcome: "target" | "stop" | null = null;
      const closes = [entry];
      for (let bar = entryBar + 1; bar <= lastBar; bar += 1) {
        const options = pool[pickSlot(bar)];
        const [, high, low, close] = options[Math.floor(random() * options.length)];
        // The stop is checked first, so a bar that touches both counts as the stop.
        if (outcome === null) {
          if (price * low <= stop) outcome = "stop";
          else if (price * high >= target) outcome = "target";
        }
        price *= close;
        closes.push(price);
      }
      onPath(closes, outcome ?? "neither");
    }
  };

  const counts = { target: 0, stop: 0, neither: 0 };
  const finals: number[] = [];
  const rs: number[] = [];
  let green = 0;
  run(replays, (closes, outcome) => {
    const final = closes.at(-1)!;
    counts[outcome as keyof typeof counts] += 1;
    finals.push(final);
    if (outcome === "target" || (outcome === "neither" && final > entry)) green += 1;
    rs.push(
      outcome === "target" ? rAtTarget : outcome === "stop" ? -1 : (final - entry) / risk,
    );
  });

  // The fan chart's bands come from a second, smaller run with the same seed.
  const columns: number[][] = Array.from({ length: lastBar - entryBar + 1 }, () => []);
  run(BAND_PATHS, (closes) => {
    closes.forEach((close, index) => columns[index].push(close));
  });

  const sorted = [...finals].sort((a, b) => a - b);
  return {
    pTarget: round(counts.target / replays, 4),
    pStop: round(counts.stop / replays, 4),
    pNeither: round(counts.neither / replays, 4),
    pGreen: round(green / replays, 4),
    medianClose: round(percentile(sorted, 0.5), 2),
    p5Close: round(percentile(sorted, 0.05), 2),
    p95Close: round(percentile(sorted, 0.95), 2),
    avgR: round(mean(rs), 3),
    rAtTarget,
    bands: columns.map((column) => {
      column.sort((a, b) => a - b);
      return BAND_QUANTILES.map((q) => round(percentile(column, q), 2));
    }),
  };
};

// The plan's rule on every past session: the first bar after the opening range to
// close above it is the entry, then stop first, then target, else the price at the end.
const replayHistory = (
  sessions: Session[],
  rule: { stopRule: HistoryStopRule; stopPct: number; targetR: number; orMinutes: number },
  lastBar: number,
) => {
  const rangeBars = rule.orMinutes / BAR_MINUTES;
  const trades: { outcome: "target" | "stop" | "neither"; r: number }[] = [];

  for (const { bars } of sessions) {
    const range = bars.slice(0, rangeBars);
    const high = Math.max(...range.map((bar) => bar.high));
    const low = Math.min(...range.map((bar) => bar.low));

    let entryBar = -1;
    for (let i = rangeBars; i <= lastBar; i += 1) {
      if (bars[i].close > high) {
        entryBar = i;
        break;
      }
    }
    if (entryBar < 0) continue;

    const entry = round(bars[entryBar].close, 2);
    const stop =
      rule.stopRule === "or_mid"
        ? centsDown((high + low) / 2)
        : rule.stopRule === "or_low"
          ? centsDown(low)
          : centsDown(entry * (1 - rule.stopPct / 100));
    const risk = entry - stop;
    if (risk <= 0) continue;
    const target = round(entry + rule.targetR * risk, 2);

    let outcome: "target" | "stop" | "neither" = "neither";
    for (let i = entryBar + 1; i <= lastBar; i += 1) {
      if (bars[i].low <= stop) {
        outcome = "stop";
        break;
      }
      if (bars[i].high >= target) {
        outcome = "target";
        break;
      }
    }

    const r =
      outcome === "target"
        ? (target - entry) / risk
        : outcome === "stop"
          ? -1
          : (bars[lastBar].close - entry) / risk;
    trades.push({ outcome, r: round(r, 2) });
  }

  return {
    sessions: sessions.length,
    triggered: trades.length,
    target: trades.filter(({ outcome }) => outcome === "target").length,
    stop: trades.filter(({ outcome }) => outcome === "stop").length,
    neither: trades.filter(({ outcome }) => outcome === "neither").length,
    avgR: trades.length ? round(mean(trades.map(({ r }) => r)), 3) : null,
    stopRule: rule.stopRule,
  };
};

const pct = (value: number) => `${(100 * value).toFixed(1)}%`;

// Compares the target's share of the replays that hit one side with the share that
// breaks even at the plan's R: 1 in (1 + R), so 50% at 1R and 33% at 2R.
const lean = ({ pTarget, pStop, rAtTarget }: { pTarget: number; pStop: number; rAtTarget: number }) => {
  if (pTarget + pStop <= 0) return null;
  const share = pTarget / (pTarget + pStop);
  const breakEven = 1 / (1 + (rAtTarget || 1));
  return { gap: share - breakEven, share, breakEven };
};

const describeVerdict = (
  odds: { pTarget: number; pStop: number; pNeither: number; avgR: number; rAtTarget: number },
  until: string,
) => {
  const at = clock12(toMinutes(until));
  const leaning = lean(odds);
  if (!leaning) {
    return {
      verdict: `No replay reached the target or the stop by ${at}: the price at ${at} decides every one.`,
      notes: [],
    };
  }

  const { gap, share, breakEven } = leaning;
  const oneR = Math.abs(odds.rAtTarget - 1) < 0.005;
  const head =
    Math.abs(gap) < COIN_FLIP
      ? oneR
        ? "Close to a coin flip"
        : "Close to break-even"
      : Math.abs(gap) < STRONG
        ? gap > 0
          ? "Leans toward the target"
          : "Leans toward the stop"
        : gap > 0
          ? "Strongly toward the target"
          : "Strongly toward the stop";
  const figures = `target first ${pct(odds.pTarget)} vs stop first ${pct(odds.pStop)}`;
  const verdict = oneR
    ? `${head}: ${figures}.`
    : `${head}: at ${round(odds.rAtTarget, 2)}R the target has to come first in ${Math.round(100 * breakEven)}% of the replays that hit one side; it did in ${Math.round(100 * share)}% (${figures}).`;

  const notes: string[] = [];
  if (odds.pNeither > MANY_NEITHER) {
    notes.push(`${pct(odds.pNeither)} of the replays hit neither by ${at}; the price at ${at} decides those.`);
  }
  if (
    Math.abs(gap) >= COIN_FLIP &&
    odds.avgR !== 0 &&
    odds.avgR > 0 !== gap > 0
  ) {
    notes.push(
      `Average R is ${odds.avgR > 0 ? "+" : ""}${odds.avgR.toFixed(3)} all the same: the replays that hit neither pull it the other way.`,
    );
  }
  return { verdict, notes };
};

export const runTimeMachine = (
  bars: Bar[],
  plan: TimeMachinePlan,
  {
    market,
    now,
    until,
    replays = DEFAULT_REPLAYS,
    seed = DEFAULT_SEED,
    window = DEFAULT_WINDOW,
  }: {
    market: MarketId;
    now: Date;
    // The end of each replay, "HH:MM". Defaults to the close.
    until?: string | null;
    replays?: number;
    seed?: number;
    window?: number;
  },
): TimeMachineOutcome => {
  const { entry, stop, target, entryBar } = plan;
  if (!(stop < entry && entry < target)) {
    return { ok: false, reason: "a long plan needs its stop under the entry and its target above it" };
  }

  const session = getSessionTimes(market, plan.date);
  const sessionBars = (session.normalClose - session.open) / BAR_MINUTES;
  const end = until ? toMinutes(until) : session.close;
  if ((end - session.open) % BAR_MINUTES !== 0 || end > session.close) {
    return {
      ok: false,
      reason: `the replays must end on the 5-minute grid, no later than the ${toHHMM(session.close)} close`,
    };
  }
  const lastBar = (end - session.open) / BAR_MINUTES - 1;
  if (lastBar <= entryBar) {
    return { ok: false, reason: `nothing is left to replay between the entry and ${toHHMM(end)}` };
  }

  const days = splitSessions(bars, market, now, session.open, sessionBars);
  const entryDay = days.get(plan.date);
  const entryBarData = entryDay?.get(entryBar);
  if (!entryBarData) {
    return {
      ok: false,
      reason: `the entry bar (closing ${toHHMM(session.open + BAR_MINUTES * (entryBar + 1))}) isn't in the data for ${plan.date} yet`,
    };
  }

  const warnings: string[] = [];
  if (entry < entryBarData.low - 0.01 || entry > entryBarData.high + 0.01) {
    warnings.push(
      `the plan's entry ${entry.toFixed(2)} is outside that bar's range, ${entryBarData.low.toFixed(2)} to ${entryBarData.high.toFixed(2)}`,
    );
  }

  // Past sessions with every bar the replays use, from the open to `until`. Replaying
  // to the close, that means full sessions only, as in the original. Ending earlier
  // matters for India: Yahoo's NSE bars after 15:15 are often empty.
  const sessions: Session[] = [...days.entries()]
    .filter(([date, day]) => {
      if (date >= plan.date) return false;
      for (let i = 0; i <= lastBar; i += 1) if (!day.has(i)) return false;
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => ({
      date,
      bars: Array.from({ length: lastBar + 1 }, (_, i) => day.get(i)!),
    }));
  if (sessions.length < MIN_SESSIONS) {
    return {
      ok: false,
      reason: `only ${sessions.length} past sessions have every 5-minute bar through ${toHHMM(end)}; the Time Machine needs at least ${MIN_SESSIONS}`,
    };
  }

  const odds = simulate({
    pool: buildPool(sessions, lastBar),
    entry,
    stop,
    target,
    entryBar,
    lastBar,
    replays,
    seed,
    window,
  });

  const riskPerShare = round(entry - stop, 2);
  const history = replayHistory(
    sessions,
    {
      stopRule: plan.stopRule,
      stopPct: round((100 * riskPerShare) / entry, 4),
      targetR: round((target - entry) / (entry - stop), 2),
      orMinutes: plan.orMinutes,
    },
    lastBar,
  );

  const until24 = toHHMM(end);
  return {
    ok: true,
    result: {
      seed,
      replays,
      until: until24,
      barsLeft: lastBar - entryBar,
      ...odds,
      bandTimes: Array.from({ length: lastBar - entryBar + 1 }, (_, i) =>
        toHHMM(session.open + BAR_MINUTES * (entryBar + 1 + i)),
      ),
      pool: {
        sessions: sessions.length,
        from: sessions[0].date,
        to: sessions.at(-1)!.date,
      },
      history,
      ...describeVerdict(odds, until24),
      warnings,
    },
  };
};
