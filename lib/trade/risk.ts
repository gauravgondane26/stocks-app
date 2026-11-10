// Ported from trader-risk/check.py in Jakeschincariol/day-trader-skill.
// MIT License, Copyright (c) 2026 Jake Schincariol. Full text in lib/trade/LICENSE.
// Checks one long entry. The app keeps no trade log, so trades and losses already
// taken today come from the person. The pattern-day-trader guard, off by default in
// the original, is left out: it needs that log and only applies to some US brokers.
// Pure: no database or network.

import type { Sizing } from "@/lib/trade/size";
import {
  moveForEarlyClose,
  toHHMM,
  toMinutes,
  type SessionTimes,
} from "@/lib/trade/session";

export type RiskCheck = { name: string; ok: boolean; detail: string };

export type RiskVerdict = {
  verdict: "PASS" | "BLOCK";
  checks: RiskCheck[];
};

export const checkRisk = ({
  sizing,
  stop,
  target,
  settings,
  tradesToday,
  lossToday,
  clock,
  formatMoney,
}: {
  sizing: Sizing;
  stop: number;
  target: number;
  settings: {
    accountSize: number;
    maxLossPerTrade: number;
    maxDailyLoss: number | null;
    maxTradesPerDay: number;
    minRewardRisk: number;
    noEntriesBefore: string;
    noEntriesAfter: string;
  };
  tradesToday: number;
  lossToday: number;
  clock: { isTradingDay: boolean; time: string; session: SessionTimes };
  formatMoney: (value: number) => string;
}): RiskVerdict => {
  const checks: RiskCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) =>
    checks.push({ name, ok, detail });

  add(
    "size",
    sizing.shares > 0,
    sizing.shares > 0
      ? `${sizing.shares} shares`
      : (sizing.refusal ?? "no shares fit your limits"),
  );

  add(
    "stop",
    stop < sizing.entry,
    stop < sizing.entry
      ? `stop ${formatMoney(stop)} is under the entry ${formatMoney(sizing.entry)}`
      : `the stop ${formatMoney(stop)} must be under the entry ${formatMoney(sizing.entry)}`,
  );

  const loss = sizing.lossAtStop;
  add(
    "loss",
    loss <= settings.maxLossPerTrade + 0.005,
    `${formatMoney(loss)} at the stop, limit ${formatMoney(settings.maxLossPerTrade)} a trade`,
  );

  const rrOk = target > sizing.entry && sizing.rewardRisk >= settings.minRewardRisk - 1e-9;
  add(
    "reward:risk",
    rrOk,
    `${sizing.rewardRisk.toFixed(2)}, minimum ${settings.minRewardRisk}`,
  );

  add(
    "cash",
    sizing.cost <= settings.accountSize + 0.005,
    `${formatMoney(sizing.cost)} of your ${formatMoney(settings.accountSize)} account`,
  );

  if (settings.maxDailyLoss !== null) {
    const total = lossToday + loss;
    add(
      "daily loss",
      total <= settings.maxDailyLoss + 0.005,
      `${formatMoney(lossToday)} already at risk today plus ${formatMoney(loss)} = ${formatMoney(total)}, limit ${formatMoney(settings.maxDailyLoss)}`,
    );
  }

  add(
    "trades",
    tradesToday < settings.maxTradesPerDay,
    `${tradesToday} taken today, limit ${settings.maxTradesPerDay} a day`,
  );

  const { session } = clock;
  const now = toMinutes(clock.time);
  const before = toMinutes(settings.noEntriesBefore);
  const after = moveForEarlyClose(toMinutes(settings.noEntriesAfter), session);
  if (!clock.isTradingDay || now < session.open || now >= session.close) {
    add("window", false, `the market is closed (${clock.time} market time)`);
  } else if (now < before) {
    add("window", false, `no new entries before ${toHHMM(before)} (it is ${clock.time})`);
  } else if (now > after) {
    add("window", false, `no new entries after ${toHHMM(after)} (it is ${clock.time})`);
  } else {
    add("window", true, `entries allowed ${toHHMM(before)} to ${toHHMM(after)}`);
  }

  return {
    verdict: checks.every(({ ok }) => ok) ? "PASS" : "BLOCK",
    checks,
  };
};
