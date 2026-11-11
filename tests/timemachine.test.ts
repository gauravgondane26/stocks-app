// Checks the Time Machine port against the day-trader skill's TSLA run
// (trader-timemachine, seed 19), Copyright (c) 2026 Jake Schincariol, MIT License.
// Fixture: tests/fixtures/skill/TSLA-60d5m.json.gz (see its LICENSE).
//
// The history replay is deterministic and must match exactly. The simulation uses a
// different seeded generator from Python's, so its odds are compared within a tolerance.
import { describe, expect, it } from "vitest";

import { runTimeMachine, type TimeMachinePlan } from "@/lib/trade/timemachine";
import { chartResult, readFixture, toBars, type YahooChart } from "./helpers/yahoo";

const bars = toBars(chartResult(readFixture<{ chart: { result: YahooChart[] } }>("TSLA-60d5m.json.gz")));
const plan: TimeMachinePlan = {
  date: "2026-10-19",
  entry: 364.18,
  stop: 358.32,
  target: 370.04,
  entryBar: 8,
  stopRule: "or_mid",
  orMinutes: 15,
};
const now = new Date("2026-10-19T10:53:00-04:00");

const run = (options: Partial<Parameters<typeof runTimeMachine>[2]> = {}, overrides: Partial<TimeMachinePlan> = {}) =>
  runTimeMachine(bars, { ...plan, ...overrides }, { market: "US", now, ...options });

const outcome = run();
if (!outcome.ok) throw new Error(`Time Machine failed on the fixture: ${outcome.reason}`);
const result = outcome.result;

describe("Time Machine on the skill's TSLA fixture", () => {
  it("draws from the same 59-session pool", () => {
    expect([result.pool.sessions, result.pool.from, result.pool.to]).toEqual([59, "2026-07-27", "2026-10-16"]);
    expect([result.barsLeft, result.until]).toEqual([69, "16:00"]);
  });

  it("matches the history replay exactly", () => {
    const { sessions, triggered, target, stop, neither, avgR } = result.history;
    expect({ sessions, triggered, target, stop, neither, avgR }).toEqual({
      sessions: 59,
      triggered: 33,
      target: 13,
      stop: 15,
      neither: 5,
      avgR: -0.062,
    });
  });

  it("starts the bands at the entry and runs them to the close", () => {
    expect(result.bands[0]).toEqual([364.18, 364.18, 364.18, 364.18, 364.18]);
    expect([result.bands.length, result.bandTimes[0], result.bandTimes.at(-1)]).toEqual([70, "10:15", "16:00"]);
  });

  // Python's numbers for the same plan, with the tolerance each is allowed.
  it.each([
    ["pTarget", result.pTarget, 0.2938, 0.015],
    ["pStop", result.pStop, 0.2548, 0.015],
    ["pNeither", result.pNeither, 0.4514, 0.015],
    ["pGreen", result.pGreen, 0.5168, 0.015],
    ["medianClose", result.medianClose, 364.36, 0.6],
    ["p5Close", result.p5Close, 355.54, 0.8],
    ["p95Close", result.p95Close, 373.54, 0.8],
    ["avgR", result.avgR, 0.034, 0.03],
  ])("%s is within tolerance of the Python run", (_, actual, python, tolerance) => {
    expect(Math.abs(actual - python)).toBeLessThanOrEqual(tolerance);
  });

  it("repeats exactly with the same seed and differs with another", () => {
    const again = run();
    expect(again.ok && again.result).toEqual(result);
    const other = run({ seed: 7 });
    expect(other.ok && other.result.pTarget).not.toBe(result.pTarget);
  });

  it("stops the replay at a flat-by time", () => {
    const flat = run({ until: "15:55" });
    expect(flat.ok && flat.result.until).toBe("15:55");
    expect(flat.ok && flat.result.barsLeft).toBeLessThan(result.barsLeft);
  });

  it("refuses an entry bar that isn't in the data yet", () => {
    expect(run({}, { entryBar: 30 }).ok).toBe(false);
  });
});
