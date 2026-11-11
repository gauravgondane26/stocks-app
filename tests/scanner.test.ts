// Checks the scanner port against the day-trader skill's worked examples
// (trader-scanner), Copyright (c) 2026 Jake Schincariol, MIT License.
// Fixtures: tests/fixtures/skill/daily-spark-2026-10-19.json and
// wall5m-2026-10-19.json.gz (see their LICENSE).
import { describe, expect, it } from "vitest";

import type { Bar, CloseSeries } from "@/lib/market/types";
import {
  confirmOrbHit,
  findOrbCandidates,
  orbWindow,
  scanDaily,
  type OrbHit,
} from "@/lib/trade/scanner";
import { readFixture, toBars, toSeries, type YahooChart } from "./helpers/yahoo";

describe("daily scan before the open on Monday 2026-10-19", () => {
  const spark = readFixture<{ spark: { result: { symbol: string; response: YahooChart[] }[] } }>(
    "daily-spark-2026-10-19.json",
  );
  const series: Record<string, CloseSeries> = {};
  for (const { symbol, response } of spark.spark.result) series[symbol] = toSeries(response[0]);
  const symbols = Object.keys(series).map((ticker) => ({ ticker, name: ticker }));
  const scan = scanDaily(series, symbols, { market: "US", now: new Date("2026-10-19T09:00:00-04:00") });
  const tags = Object.fromEntries(scan.hits.map((hit) => [hit.ticker, hit.setups as string[]]));

  it.each([
    ["BLK", "breakout_20d"],
    ["CI", "breakout_20d"],
    ["XOM", "breakout_20d"],
    ["HD", "breakout_20d"],
    ["KO", "breakout_20d"],
    ["CCL", "bull_flag"],
    ["RCL", "bull_flag"],
    ["F", "reclaim_ma20"],
    ["JPM", "reclaim_ma20"],
    ["GE", "reclaim_ma20"],
    ["BAC", "oversold"],
    ["MS", "oversold"],
    ["RIVN", "oversold"],
    ["PLUG", "oversold"],
    ["PNC", "oversold_bounce"],
  ])("tags %s as %s", (ticker, setup) => {
    expect(tags[ticker] ?? []).toContain(setup);
  });

  it("uses Friday's close", () => {
    expect(scan.closeDate).toBe("2026-10-16");
  });
});

describe("opening-range breakout scan at 10:15 on 2026-10-19", () => {
  const wall = readFixture<Record<string, { chart?: { result?: YahooChart[] } } | null>>("wall5m-2026-10-19.json.gz");
  const series: Record<string, CloseSeries> = {};
  const bars: Record<string, Bar[]> = {};
  for (const [ticker, doc] of Object.entries(wall)) {
    const chart = doc?.chart?.result?.[0];
    if (!chart?.timestamp) continue;
    series[ticker] = toSeries(chart);
    bars[ticker] = toBars(chart);
  }
  const symbols = Object.keys(wall).map((ticker) => ({ ticker, name: ticker }));
  const window = orbWindow("US", new Date("2026-10-19T10:15:00-04:00"), { noEntriesAfter: "15:30" });
  if (!window.ok) throw new Error(window.reason);

  const { candidates, counts } = findOrbCandidates(series, symbols, { market: "US", window });
  const hits: OrbHit[] = [];
  for (const candidate of candidates) {
    const hit = confirmOrbHit(bars[candidate.ticker] ?? [], candidate, { market: "US", window });
    if (hit && hit !== "unusable") hits.push(hit);
  }

  it("matches the skill's counts: 231 usable charts, 95 candidates, 42 breakouts", () => {
    expect(counts.scanned).toBe(231);
    expect(counts.candidates).toBe(95);
    expect(hits).toHaveLength(42);
  });

  it("finds TSLA breaking out at 10:15", () => {
    expect(hits.find((hit) => hit.ticker === "TSLA")?.at).toBe("10:15");
  });

  it("has no window before the range completes or after the entry cutoff", () => {
    expect(orbWindow("US", new Date("2026-10-19T09:45:00-04:00"), { noEntriesAfter: "15:30" }).ok).toBe(false);
    expect(orbWindow("US", new Date("2026-10-19T15:40:00-04:00"), { noEntriesAfter: "15:30" }).ok).toBe(false);
  });

  it("opens an Indian window by 10:00 IST", () => {
    expect(orbWindow("IN", new Date("2026-11-11T10:00:00+05:30"), { noEntriesAfter: "15:00" }).ok).toBe(true);
  });
});
