// Checks the trade tool ports against the day-trader skill's worked TSLA example
// (README and tests), Copyright (c) 2026 Jake Schincariol, MIT License.
// Fixture: tests/fixtures/skill/TSLA-2026-10-19-5m.json (see its LICENSE).
import { describe, expect, it } from "vitest";

import { evaluateEntry } from "@/lib/trade/entry";
import { computeExitPlan, resolveFlatBy } from "@/lib/trade/exit";
import { checkRisk } from "@/lib/trade/risk";
import { getSessionTimes } from "@/lib/trade/session";
import { sizeTrade } from "@/lib/trade/size";
import { chartResult, readFixture, toBars, type YahooChart } from "./helpers/yahoo";

const bars = toBars(chartResult(readFixture<{ chart: { result: YahooChart[] } }>("TSLA-2026-10-19-5m.json")));
const newYork = (hhmm: string) => new Date(`2026-10-19T${hhmm}:00-04:00`);
const window = { noEntriesBefore: "09:45", noEntriesAfter: "15:30" };
const entryAt = (hhmm: string) => evaluateEntry(bars, { market: "US", now: newYork(hhmm), ...window });
const openingRange = { high: 362.18, low: 354.47 };
const money = (value: number) => `$${value.toFixed(2)}`;

describe("entry check", () => {
  it("reports the phase before the range is complete", () => {
    expect(entryAt("09:20").phase).toBe("pre-open");
    expect(entryAt("09:40").phase).toBe("forming");
  });

  it("is waiting at 10:12 with the skill's opening range", () => {
    const result = entryAt("10:12");
    expect(result.status).toBe("waiting");
    expect([result.openingRange?.high, result.openingRange?.low]).toEqual([362.18, 354.47]);
    expect(result.last?.close).toBe(361.68);
    expect(result.forming?.barStart).toBe("10:10");
  });

  it("triggers on the 10:15 bar's close above the range", () => {
    const result = entryAt("10:16");
    expect(result.status).toBe("triggered");
    expect([result.trigger?.time, result.trigger?.price, result.trigger?.barIndex]).toEqual(["10:15", 364.18, 8]);
  });
});

describe("exit plan", () => {
  const plan = (targetR: number) =>
    computeExitPlan({ entry: 364.18, stopRule: "or_mid", stopParam: null, targetR, openingRange, atrBars: [] });

  it("matches the 1R plan to the cent", () => {
    const result = plan(1);
    if (!result.ok) throw new Error(result.reason);
    const { stop, target, riskPerShare, rewardRisk, riskPct } = result.plan;
    expect({ stop, target, riskPerShare, rewardRisk, riskPct }).toEqual({
      stop: 358.32,
      target: 370.04,
      riskPerShare: 5.86,
      rewardRisk: 1,
      riskPct: 1.61,
    });
  });

  it("puts the 2R target at 375.90", () => {
    const result = plan(2);
    expect(result.ok && result.plan.target).toBe(375.9);
  });

  it("refuses a stop above the entry or too close to it", () => {
    const price = (stop: number) =>
      computeExitPlan({ entry: 100, stopRule: "price", stopParam: stop, targetR: 2, openingRange: null, atrBars: [] });
    expect(price(101).ok).toBe(false);
    expect(price(99.99).ok).toBe(false);
  });

  it("builds an ATR stop from the bars up to the trigger", () => {
    const triggered = entryAt("10:16");
    const result = computeExitPlan({
      entry: 364.18,
      stopRule: "atr",
      stopParam: 1.5,
      targetR: 2,
      openingRange: null,
      atrBars: triggered.bars.filter((bar) => bar.slot <= 8),
    });
    expect(result.ok).toBe(true);
  });

  it("moves the flat-by time for early closes", () => {
    expect(resolveFlatBy("15:55", getSessionTimes("US", "2026-10-19"), "10:15")).toEqual({
      ok: true,
      flatBy: "15:55",
      moved: false,
    });
    expect(resolveFlatBy("15:55", getSessionTimes("US", "2026-11-27"), null)).toMatchObject({ flatBy: "12:55" });
    expect(resolveFlatBy("15:15", getSessionTimes("IN", "2026-11-11"), null)).toMatchObject({ flatBy: "15:15" });
  });
});

describe("sizing and risk check", () => {
  const sizing = sizeTrade({
    entry: 364.18,
    stop: 358.32,
    target: 370.04,
    latestPrice: null,
    accountSize: 10_000,
    maxLossPerTrade: 50,
    minRewardRisk: 1,
    formatMoney: money,
  });
  const settings = { accountSize: 10_000, maxLossPerTrade: 50, maxDailyLoss: 150, maxTradesPerDay: 3, minRewardRisk: 1, ...window };
  const session = getSessionTimes("US", "2026-10-19");
  const check = (tradesToday: number, lossToday: number, time: string) =>
    checkRisk({
      sizing,
      stop: 358.32,
      target: 370.04,
      settings,
      tradesToday,
      lossToday,
      clock: { isTradingDay: true, time, session },
      formatMoney: money,
    });
  const failed = (verdict: ReturnType<typeof check>) => verdict.checks.filter((c) => !c.ok).map((c) => c.name);

  it("sizes 8 shares for a $50 max loss", () => {
    expect([sizing.shares, sizing.boundBy, sizing.lossAtStop, sizing.refusal]).toEqual([8, "max loss", 46.88, null]);
  });

  it("uses a fresher price as the entry, which can fail the reward-to-risk check", () => {
    const fresher = sizeTrade({
      entry: 364.18,
      stop: 358.32,
      target: 370.04,
      latestPrice: 366.48,
      accountSize: 10_000,
      maxLossPerTrade: 50,
      minRewardRisk: 1,
      formatMoney: money,
    });
    expect([fresher.entry, fresher.entryFrom]).toEqual([366.48, "price"]);
    expect(fresher.refusal).not.toBeNull();
  });

  it("passes inside every limit", () => {
    expect(check(0, 0, "10:16").verdict).toBe("PASS");
  });

  it("blocks after the day's trade limit", () => {
    const verdict = check(3, 0, "10:16");
    expect(verdict.verdict).toBe("BLOCK");
    expect(failed(verdict)).toEqual(["trades"]);
  });

  it("blocks past the daily loss limit and the entry window", () => {
    expect(failed(check(1, 120, "15:40"))).toEqual(["daily loss", "window"]);
  });
});
