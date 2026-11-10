// Ported from trader-exit/exit.py in Jakeschincariol/day-trader-skill.
// MIT License, Copyright (c) 2026 Jake Schincariol. Full text in lib/trade/LICENSE.
// Long trades only. Prices are worked in whole cents so rounding matches the original.
// Pure: no database or network.

import type { Bar } from "@/lib/market/types";
import {
  moveForEarlyClose,
  toHHMM,
  toMinutes,
  type SessionTimes,
} from "@/lib/trade/session";

const ATR_BARS = 14;
// A risk under 0.05% of the price is inside the spread's noise.
const MIN_RISK_PCT = 0.05;
const EPSILON = 1e-9;

export type StopRule = "or_mid" | "or_low" | "pct" | "atr" | "price";

export type ExitPlan = {
  entry: number;
  stop: number;
  stopLabel: string;
  stopDetail: string;
  target: number;
  targetLabel: string;
  riskPerShare: number;
  riskPct: number;
  rewardRisk: number;
};

export type ExitResult = { ok: true; plan: ExitPlan } | { ok: false; reason: string };

const centsHalfUp = (value: number) => Math.floor(value * 100 + 0.5 + EPSILON);
const fromCents = (cents: number) => cents / 100;
const money = (cents: number) => fromCents(cents).toFixed(2);

const R_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
};
const rLabel = (r: number) => `${r}R (${R_WORDS[r] ?? r} times the risk)`;

// Average true range of the last 14 bars, or all of them if fewer. The first bar of
// the session uses its own high minus low, with no overnight gap.
export const averageTrueRange = (bars: Bar[]) => {
  const ranges: number[] = [];
  let previousClose: number | null = null;
  for (const { high, low, close } of bars) {
    let range = high - low;
    if (previousClose !== null) {
      range = Math.max(
        range,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose),
      );
    }
    ranges.push(range);
    previousClose = close;
  }
  const used = ranges.slice(-ATR_BARS);
  return {
    atr: used.reduce((sum, value) => sum + value, 0) / (used.length || 1),
    bars: used.length,
  };
};

export const computeExitPlan = ({
  entry,
  stopRule,
  stopParam,
  targetR,
  openingRange,
  atrBars,
}: {
  entry: number;
  stopRule: StopRule;
  // The percent, ATR multiple or price, for the rules that take one.
  stopParam: number | null;
  targetR: number;
  openingRange: { high: number; low: number } | null;
  atrBars: Bar[];
}): ExitResult => {
  const entryCents = centsHalfUp(entry);
  if (!(entryCents > 0)) {
    return { ok: false, reason: "the entry price must be above zero" };
  }
  if (!(targetR > 0)) {
    return { ok: false, reason: "the target needs an R multiple above 0, like 1R or 2R" };
  }

  let rawCents: number;
  let label: string;
  let detail = "";

  if (stopRule === "or_mid" || stopRule === "or_low") {
    if (!openingRange) {
      return { ok: false, reason: "an opening-range stop needs the opening range, which isn't set yet" };
    }
    const high = centsHalfUp(openingRange.high);
    const low = centsHalfUp(openingRange.low);
    if (high <= low) {
      return { ok: false, reason: "the opening-range high must be above its low" };
    }
    if (stopRule === "or_mid") {
      rawCents = (high + low) / 2;
      label = "opening-range midpoint";
      detail = `(${money(high)} + ${money(low)}) / 2 = ${(rawCents / 100).toString()}`;
    } else {
      rawCents = low;
      label = "opening-range low";
    }
  } else if (stopRule === "pct") {
    if (stopParam === null || !(stopParam > 0) || stopParam >= 100) {
      return { ok: false, reason: "a percent stop needs a number above 0 and under 100" };
    }
    rawCents = (entryCents * (100 - stopParam)) / 100;
    label = `${stopParam}% under the entry`;
  } else if (stopRule === "atr") {
    if (stopParam === null || !(stopParam > 0)) {
      return { ok: false, reason: "an ATR stop needs a multiple above 0, like 1.5" };
    }
    if (atrBars.length < 3) {
      return { ok: false, reason: `an ATR stop needs at least 3 closed bars today; there are ${atrBars.length}` };
    }
    const { atr, bars } = averageTrueRange(atrBars);
    rawCents = entryCents - stopParam * atr * 100;
    label = `${stopParam} x ATR(${bars}) under the entry`;
    detail = `ATR ${atr.toFixed(4)} over ${bars} bars${bars < ATR_BARS ? " (fewer than 14 so far)" : ""}`;
  } else {
    if (stopParam === null || !(stopParam > 0)) {
      return { ok: false, reason: "enter a stop price above zero" };
    }
    rawCents = stopParam * 100;
    label = "your price";
  }

  // A long's stop rounds down, away from the entry.
  const stopCents = Math.floor(rawCents + EPSILON);
  if (Math.abs(stopCents - rawCents) > EPSILON) {
    detail = detail ? `${detail}, rounded down` : "rounded down";
  }
  if (stopCents >= entryCents) {
    return {
      ok: false,
      reason: `the stop ${money(stopCents)} (${label}) is at or above the entry ${money(entryCents)}: a long's stop goes under the entry`,
    };
  }
  if (stopCents <= 0) {
    return { ok: false, reason: `the stop works out to ${money(stopCents)}: pick a stop above zero` };
  }

  const riskCents = entryCents - stopCents;
  const minRiskCents = (entryCents * MIN_RISK_PCT) / 100;
  if (riskCents < minRiskCents) {
    return {
      ok: false,
      reason: `the stop is ${money(riskCents)} under the entry, less than 0.05% of the price: too tight to survive the spread, so normal wiggle would stop you out. Widen it.`,
    };
  }

  const targetCents = centsHalfUp(fromCents(entryCents + targetR * riskCents));
  if (targetCents <= entryCents) {
    return { ok: false, reason: "the target must be above the entry" };
  }

  return {
    ok: true,
    plan: {
      entry: fromCents(entryCents),
      stop: fromCents(stopCents),
      stopLabel: label,
      stopDetail: detail,
      target: fromCents(targetCents),
      targetLabel: rLabel(targetR),
      riskPerShare: fromCents(riskCents),
      riskPct: centsHalfUp((riskCents / entryCents) * 100) / 100,
      rewardRisk: centsHalfUp((targetCents - entryCents) / riskCents) / 100,
    },
  };
};

// The flat-by time moves up with an early close. An entry at or after it is refused.
export const resolveFlatBy = (
  flatBy: string,
  session: SessionTimes,
  entryTime: string | null,
): { ok: true; flatBy: string; moved: boolean } | { ok: false; reason: string } => {
  const original = toMinutes(flatBy);
  const time = moveForEarlyClose(original, session);
  if (entryTime && toMinutes(entryTime) >= time) {
    return {
      ok: false,
      reason: `the entry at ${entryTime} is at or after your flat-by time ${toHHMM(time)}: there's no time left to hold it`,
    };
  }
  return { ok: true, flatBy: toHHMM(time), moved: time !== original };
};
