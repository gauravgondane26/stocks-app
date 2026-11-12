import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import type { Bar, CloseSeries } from "@/lib/market/types";

// The parts of a Yahoo v8 chart result the fixtures use.
export type YahooChart = {
  meta?: { regularMarketPrice?: number; regularMarketVolume?: number };
  timestamp?: number[];
  indicators: {
    quote: {
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    }[];
  };
};

const fixturePath = (name: string) =>
  new URL(`../fixtures/skill/${name}`, import.meta.url);

export const readFixture = <T>(name: string): T => {
  const raw = readFileSync(fixturePath(name));
  const text = name.endsWith(".gz") ? gunzipSync(raw).toString() : raw.toString();
  return JSON.parse(text) as T;
};

export const chartResult = (doc: { chart: { result: YahooChart[] } }) => doc.chart.result[0];

// The same filtering the Yahoo provider does: a bar needs all four prices.
export const toBars = (chart: YahooChart): Bar[] => {
  const quote = chart.indicators.quote[0];
  const bars: Bar[] = [];
  (chart.timestamp ?? []).forEach((time, i) => {
    const [open, high, low, close] = [quote.open[i], quote.high[i], quote.low[i], quote.close[i]];
    if (open == null || high == null || low == null || close == null) return;
    bars.push({ time: time * 1000, open, high, low, close, volume: quote.volume[i] ?? 0 });
  });
  return bars;
};

export const toSeries = (chart: YahooChart): CloseSeries => {
  const quote = chart.indicators.quote[0];
  const points: CloseSeries["points"] = [];
  (chart.timestamp ?? []).forEach((time, i) => {
    const close = quote.close[i];
    if (close != null) points.push({ time: time * 1000, close });
  });
  return {
    points,
    price: chart.meta?.regularMarketPrice ?? null,
    volume: chart.meta?.regularMarketVolume ?? null,
  };
};
