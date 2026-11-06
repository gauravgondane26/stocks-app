import "server-only";

import { fetchJson } from "@/lib/market/http";
import { MARKETS } from "@/lib/market/markets";
import { toYahoo } from "@/lib/market/symbols";
import type {
  Bar,
  BarRequest,
  CompanyProfile,
  MarketDataProvider,
  MarketDataResult,
  Quote,
  StockSymbol,
} from "@/lib/market/types";

// Yahoo's chart endpoint is unofficial and can change or rate-limit without notice.
const BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

type ChartMeta = {
  currency?: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
};

type ChartQuote = {
  open?: (number | null)[];
  high?: (number | null)[];
  low?: (number | null)[];
  close?: (number | null)[];
  volume?: (number | null)[];
};

type ChartResponse = {
  chart?: {
    result?:
      | {
          meta?: ChartMeta;
          timestamp?: number[];
          indicators?: { quote?: ChartQuote[] };
        }[]
      | null;
  };
};

const REVALIDATE_SECONDS: Record<BarRequest["interval"], number> = {
  "1m": 30,
  "5m": 60,
  "1d": 3600,
};

const fetchChart = async (
  symbol: StockSymbol,
  { interval, range }: BarRequest,
  revalidate: number,
) => {
  const ticker = encodeURIComponent(toYahoo(symbol));
  const result = await fetchJson<ChartResponse>(
    `${BASE_URL}/${ticker}?interval=${interval}&range=${range}`,
    { revalidate, source: "Yahoo chart" },
  );
  if (!result.ok) return result;

  const chart = result.data.chart?.result?.[0];
  return chart
    ? ({ ok: true, data: chart } as const)
    : ({ ok: false, reason: "not_found" } as const);
};

// Yahoo sends null prices for minutes with no trades, so those bars are dropped.
const toBars = (
  timestamps: number[] = [],
  quote: ChartQuote = {},
): Bar[] => {
  const bars: Bar[] = [];
  timestamps.forEach((timestamp, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    if (open == null || high == null || low == null || close == null) return;

    bars.push({
      time: timestamp * 1000,
      open,
      high,
      low,
      close,
      volume: quote.volume?.[index] ?? 0,
    });
  });
  return bars;
};

const toCalendarDay = (epochMs: number, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone }).format(epochMs);

// Uses the last daily close from before the latest trade's date. Yahoo's
// `chartPreviousClose` can't be trusted here: on `^NSEI` it returned the close
// from two sessions back.
const findPreviousClose = (
  bars: Bar[],
  latestTradeMs: number,
  timeZone: string,
): number | null => {
  const latestDay = toCalendarDay(latestTradeMs, timeZone);
  for (let index = bars.length - 1; index >= 0; index -= 1) {
    if (toCalendarDay(bars[index].time, timeZone) < latestDay) {
      return bars[index].close;
    }
  }
  return null;
};

export const yahooProvider: Pick<
  MarketDataProvider,
  "quote" | "bars" | "profile"
> = {
  async quote(symbol): Promise<MarketDataResult<Quote>> {
    const result = await fetchChart(
      symbol,
      { interval: "1d", range: "1mo" },
      REVALIDATE_SECONDS["1m"],
    );
    if (!result.ok) return result;

    const { meta, timestamp, indicators } = result.data;
    const price = meta?.regularMarketPrice;
    if (price == null || !meta?.currency) {
      return { ok: false, reason: "unavailable" };
    }

    const asOf = (meta.regularMarketTime ?? 0) * 1000;
    const previousClose = findPreviousClose(
      toBars(timestamp, indicators?.quote?.[0]),
      asOf,
      MARKETS[symbol.market].timeZone,
    );
    const change = previousClose == null ? null : price - previousClose;

    return {
      ok: true,
      data: {
        symbol,
        price,
        previousClose,
        change,
        changePercent:
          change == null || !previousClose
            ? null
            : (change / previousClose) * 100,
        dayHigh: meta.regularMarketDayHigh ?? null,
        dayLow: meta.regularMarketDayLow ?? null,
        volume: meta.regularMarketVolume ?? null,
        currency: meta.currency,
        asOf,
      },
    };
  },

  async bars(symbol, request): Promise<MarketDataResult<Bar[]>> {
    const result = await fetchChart(
      symbol,
      request,
      REVALIDATE_SECONDS[request.interval],
    );
    if (!result.ok) return result;

    return {
      ok: true,
      data: toBars(result.data.timestamp, result.data.indicators?.quote?.[0]),
    };
  },

  // Yahoo's chart data only carries the basics, so the other fields stay empty.
  async profile(symbol): Promise<MarketDataResult<CompanyProfile>> {
    const result = await fetchChart(
      symbol,
      { interval: "1d", range: "1mo" },
      REVALIDATE_SECONDS["1d"],
    );
    if (!result.ok) return result;

    const { meta } = result.data;
    const name = meta?.longName ?? meta?.shortName;
    if (!name) return { ok: false, reason: "not_found" };

    return {
      ok: true,
      data: {
        symbol,
        name,
        currency: meta?.currency ?? null,
        industry: null,
        marketCap: null,
        logoUrl: null,
        websiteUrl: null,
      },
    };
  },
};
