"use server";

import { headers } from "next/headers";

import { getCurrentUser } from "@/lib/better-auth/session";
import { getMarketData } from "@/lib/market";
import { getMarketClock } from "@/lib/market/hours";
import { MARKETS } from "@/lib/market/markets";
import { allowCaller, clientIp } from "@/lib/rate-limit";
import { toMinutes } from "@/lib/trade/session";
import {
  runTimeMachine,
  type HistoryStopRule,
  type TimeMachineResult,
} from "@/lib/trade/timemachine";
import { validateWatchlistAddition } from "@/lib/validation/watchlist";

const RUN_LIMITS = { perCaller: 6, allGuests: 30, windowMs: 60_000 };
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const OR_STOP_RULES = new Set(["or_mid", "or_low"]);

export type TimeMachineActionResult =
  | { ok: true; result: TimeMachineResult; elapsedMs: number }
  | { ok: false; error: string };

const positive = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

// Replays today's plan for one stock. The date always comes from the server clock.
// Guests can run it too, limited per IP.
export const runTimeMachineAction = async (
  input: unknown,
): Promise<TimeMachineActionResult> => {
  const user = await getCurrentUser();

  // Reuses the stock checks; the company name isn't needed here.
  const raw = (input ?? {}) as Record<string, unknown>;
  const stock = validateWatchlistAddition({ ...raw, company: "-" });
  if (!stock.valid) return { ok: false, error: stock.error };
  const { market, exchange, ticker } = stock.data;

  const entry = positive(raw.entry);
  const stop = positive(raw.stop);
  const target = positive(raw.target);
  if (entry === null || stop === null || target === null) {
    return { ok: false, error: "The plan needs an entry, stop and target." };
  }

  const entryTime = typeof raw.entryTime === "string" ? raw.entryTime : "";
  const until = typeof raw.until === "string" ? raw.until : "";
  if (!TIME_PATTERN.test(entryTime) || !TIME_PATTERN.test(until)) {
    return { ok: false, error: "The plan needs an entry time and a flat-by time." };
  }
  const entryBar = (toMinutes(entryTime) - toMinutes(MARKETS[market].open)) / 5 - 1;
  if (!Number.isInteger(entryBar) || entryBar < 0) {
    return { ok: false, error: "The entry time must be a 5-minute bar's close." };
  }

  // The history replay knows the opening-range stops. Any other stop is replayed as
  // the same distance, as a percent of the entry, which is what the original does.
  const stopRule: HistoryStopRule = OR_STOP_RULES.has(String(raw.stopRule))
    ? (raw.stopRule as HistoryStopRule)
    : "pct";

  const caller = user ? { userId: user.id } : { ip: clientIp(await headers()) };
  if (!allowCaller("timemachine", caller, RUN_LIMITS)) {
    return { ok: false, error: "Too many runs. Wait a minute and try again." };
  }

  const started = performance.now();
  const symbol = { market, exchange, ticker };
  const bars = await getMarketData(market).bars(symbol, { interval: "5m", range: "60d" });
  if (!bars.ok) {
    return { ok: false, error: "Price history is unavailable right now. Please try again." };
  }

  const now = new Date();
  const outcome = runTimeMachine(
    bars.data,
    {
      date: getMarketClock(market, now).date,
      entry,
      stop,
      target,
      entryBar,
      stopRule,
      orMinutes: 15,
    },
    { market, now, until },
  );
  const elapsedMs = Math.round(performance.now() - started);
  console.info(`Time Machine for ${ticker} took ${elapsedMs} ms`);

  return outcome.ok
    ? { ok: true, result: outcome.result, elapsedMs }
    : { ok: false, error: `The Time Machine can't run this plan: ${outcome.reason}.` };
};
