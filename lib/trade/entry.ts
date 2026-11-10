// Ported from trader-entry/entry.py in Jakeschincariol/day-trader-skill.
// MIT License, Copyright (c) 2026 Jake Schincariol. Full text in lib/trade/LICENSE.
// Opening-range breakout only. The level setup and the volume filter come with the
// scanner. Pure: no database or network.

import { getMarketClock, isTradingDay } from "@/lib/market/hours";
import type { Bar, MarketId } from "@/lib/market/types";
import {
  getSessionTimes,
  moveForEarlyClose,
  toHHMM,
  toMinutes,
} from "@/lib/trade/session";

const BAR_MINUTES = 5;
const BAR_MS = BAR_MINUTES * 60_000;
// Yahoo can be a minute behind, so a bar counts once a minute has passed after its
// close, or once a later bar exists.
const SETTLE_MS = 60_000;

export type EntryStatus = "no-data" | "waiting" | "triggered" | "expired";
export type EntryPhase =
  | "closed"
  | "pre-open"
  | "forming"
  | "open"
  | "after-cutoff"
  | "after-close";

export type SessionBar = Bar & { slot: number; start: number; end: number };

export type EntryResult = {
  status: EntryStatus;
  phase: EntryPhase;
  reason: string;
  date: string;
  openingRange: {
    high: number;
    low: number;
    bars: number;
    of: number;
    complete: boolean;
  } | null;
  level: number | null;
  trigger: {
    time: string;
    barStart: string;
    barIndex: number;
    price: number;
  } | null;
  last: { barStart: string; close: number; vsLevelPct: number } | null;
  forming: { barStart: string; price: number; closes: string } | null;
  window: { noEntriesBefore: string; noEntriesAfter: string };
  // Closed bars of the session, for an ATR stop.
  bars: SessionBar[];
};

const round2 = (value: number) => Math.round(value * 100) / 100 + 0;
const money = (value: number) => value.toFixed(2);

export const evaluateEntry = (
  rawBars: Bar[],
  {
    market,
    now,
    orMinutes = 15,
    noEntriesBefore,
    noEntriesAfter,
  }: {
    market: MarketId;
    now: Date;
    orMinutes?: number;
    noEntriesBefore: string;
    noEntriesAfter: string;
  },
): EntryResult => {
  const { date, time } = getMarketClock(market, now);
  const nowMinutes = toMinutes(time);
  const nowMs = now.getTime();
  const session = getSessionTimes(market, date);
  const before = toMinutes(noEntriesBefore);
  const cutoff = moveForEarlyClose(toMinutes(noEntriesAfter), session);
  const orEnd = session.open + orMinutes;
  const rangeBars = orMinutes / BAR_MINUTES;

  const result: EntryResult = {
    status: "waiting",
    phase: "open",
    reason: "",
    date,
    openingRange: null,
    level: null,
    trigger: null,
    last: null,
    forming: null,
    window: { noEntriesBefore: toHHMM(before), noEntriesAfter: toHHMM(cutoff) },
    bars: [],
  };

  if (!isTradingDay(market, now)) {
    return {
      ...result,
      status: "no-data",
      phase: "closed",
      reason: "the market is closed today",
    };
  }

  // Yahoo's live tick, like 10:49:45, is off the 5-minute grid and is not a bar.
  const bySlot = new Map<number, SessionBar>();
  for (const bar of rawBars) {
    if (bar.time % BAR_MS !== 0) continue;
    const local = getMarketClock(market, new Date(bar.time));
    const start = toMinutes(local.time);
    if (local.date !== date || start < session.open || start >= session.close) {
      continue;
    }
    const slot = (start - session.open) / BAR_MINUTES;
    bySlot.set(slot, { ...bar, slot, start, end: start + BAR_MINUTES });
  }

  const slots = [...bySlot.keys()].sort((a, b) => a - b);
  const top = slots.at(-1) ?? -1;
  const bars: SessionBar[] = [];
  let pending: SessionBar | null = null;
  for (const slot of slots) {
    const bar = bySlot.get(slot)!;
    const endMs = bar.time + BAR_MS;
    if (endMs <= nowMs) {
      if (slot < top || nowMs >= endMs + SETTLE_MS) {
        bars.push(bar);
      } else {
        pending = bar;
        result.forming = {
          barStart: toHHMM(bar.start),
          price: round2(bar.close),
          closes: toHHMM(bar.end),
        };
      }
    } else if (bar.time <= nowMs) {
      result.forming = {
        barStart: toHHMM(bar.start),
        price: round2(bar.close),
        closes: toHHMM(bar.end),
      };
    }
  }
  result.bars = bars;

  if (nowMinutes < session.open) {
    return {
      ...result,
      phase: "pre-open",
      reason: `the market opens at ${toHHMM(session.open)} and the ${orMinutes}-minute range is set at ${toHHMM(orEnd)}`,
    };
  }

  const orBars = bars.filter(({ slot }) => slot < rangeBars);
  if (orBars.length > 0) {
    result.openingRange = {
      high: round2(Math.max(...orBars.map(({ high }) => high))),
      low: round2(Math.min(...orBars.map(({ low }) => low))),
      bars: orBars.length,
      of: rangeBars,
      complete: nowMinutes >= orEnd,
    };
  }
  if (nowMinutes < orEnd) {
    return {
      ...result,
      phase: "forming",
      reason: `${orBars.length} of ${rangeBars} range bars closed; the range is set at ${toHHMM(orEnd)}`,
    };
  }
  if (orBars.length === 0) {
    return {
      ...result,
      status: "no-data",
      reason: "no price bars arrived for the opening range",
    };
  }

  const level = Math.max(...orBars.map(({ high }) => high));
  result.level = round2(level);

  // The trigger is the first closed bar after the range to CLOSE above it. A close
  // exactly at the level is not above it, and a wick above doesn't count.
  const trigger = bars.find(
    ({ slot, end, close }) =>
      slot >= rangeBars && end >= before && end <= cutoff && close > level,
  );
  const last = bars.at(-1);
  if (last) {
    result.last = {
      barStart: toHHMM(last.start),
      close: round2(last.close),
      vsLevelPct: round2(100 * (last.close / level - 1)),
    };
  }

  if (trigger) {
    return {
      ...result,
      status: "triggered",
      phase: nowMinutes < session.close ? "open" : "after-close",
      reason: `the ${toHHMM(trigger.start)} bar closed above the range high`,
      trigger: {
        time: toHHMM(trigger.end),
        barStart: toHHMM(trigger.start),
        barIndex: trigger.slot,
        price: round2(trigger.close),
      },
    };
  }
  if (!last) {
    return { ...result, status: "no-data", reason: "no price bars yet today" };
  }

  if (nowMinutes >= cutoff && !(pending && pending.end <= cutoff)) {
    return {
      ...result,
      status: "expired",
      phase: nowMinutes >= session.close ? "after-close" : "after-cutoff",
      reason: `no close above the range high ${money(level)} by ${toHHMM(cutoff)}, the last time for a new entry`,
    };
  }

  if (last.close > level && last.end < before) {
    return {
      ...result,
      reason: `the ${toHHMM(last.start)} bar closed above at ${money(last.close)}, but no entries before ${toHHMM(before)}`,
    };
  }

  const gap = level - last.close;
  return {
    ...result,
    reason: `last close ${money(last.close)} (${toHHMM(last.start)} bar), ${money(Math.abs(gap))} ${gap >= 0 ? "under" : "over"} the range high ${money(level)}`,
  };
};
