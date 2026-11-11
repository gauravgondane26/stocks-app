import "server-only";

import { fetchJson } from "@/lib/market/http";
import { MARKETS } from "@/lib/market/markets";
import { companyAliases, filterNews, NEWS_DAYS } from "@/lib/market/news";
import type {
  CompanyProfile,
  MarketDataProvider,
  MarketDataResult,
  NewsItem,
  StockSearchResult,
} from "@/lib/market/types";

// The free Finnhub plan covers US search, profiles and news. It returns 403 for
// Indian quotes, profiles and news, and for candles in every market.
const BASE_URL = "https://finnhub.io/api/v1";
const MAX_SEARCH_RESULTS = 10;

type FinnhubSearch = {
  result?: { symbol: string; description: string; type: string }[];
};

type FinnhubProfile = {
  name?: string;
  currency?: string;
  exchange?: string;
  finnhubIndustry?: string;
  marketCapitalization?: number;
  logo?: string;
  weburl?: string;
};

type FinnhubMetrics = {
  metric?: { peTTM?: number | null };
};

type FinnhubNews = {
  headline: string;
  summary: string;
  url: string;
  source: string;
  image: string;
  datetime: number;
}[];

const request = <T>(path: string, revalidate: number) => {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    console.warn("FINNHUB_API_KEY is not set.");
    return Promise.resolve({
      ok: false,
      reason: "unavailable",
    } as MarketDataResult<T>);
  }

  return fetchJson<T>(`${BASE_URL}${path}`, {
    revalidate,
    source: "Finnhub",
    headers: { "X-Finnhub-Token": key },
  });
};

const toDateParam = (date: Date) => date.toISOString().slice(0, 10);

export const finnhubProvider: Pick<
  MarketDataProvider,
  "search" | "profile" | "news"
> = {
  async search(query): Promise<MarketDataResult<StockSearchResult[]>> {
    const result = await request<FinnhubSearch>(
      `/search?q=${encodeURIComponent(query)}&exchange=US`,
      3600,
    );
    if (!result.ok) return result;

    const seen = new Set<string>();
    const stocks: StockSearchResult[] = [];
    for (const { symbol, description, type } of result.data.result ?? []) {
      // Dotted symbols are other share classes or foreign listings.
      if (type !== "Common Stock" || symbol.includes(".")) continue;
      if (seen.has(symbol)) continue;
      seen.add(symbol);

      stocks.push({
        // Finnhub search doesn't say which exchange, see toTradingView.
        symbol: {
          market: "US",
          exchange: MARKETS.US.unresolvedExchange,
          ticker: symbol,
        },
        name: description,
      });
    }

    return { ok: true, data: stocks.slice(0, MAX_SEARCH_RESULTS) };
  },

  async profile(symbol): Promise<MarketDataResult<CompanyProfile>> {
    const ticker = encodeURIComponent(symbol.ticker);
    const [result, metrics] = await Promise.all([
      request<FinnhubProfile>(`/stock/profile2?symbol=${ticker}`, 86_400),
      request<FinnhubMetrics>(`/stock/metric?symbol=${ticker}&metric=all`, 86_400),
    ]);
    if (!result.ok) return result;

    const { name, currency, exchange, finnhubIndustry, marketCapitalization, logo, weburl } =
      result.data;
    // Finnhub answers an unknown ticker with an empty object rather than a 404.
    if (!name) return { ok: false, reason: "not_found" };

    // Finnhub names exchanges in full, such as "NASDAQ NMS - GLOBAL MARKET".
    const exchangeCode = MARKETS.US.exchanges.find(({ code }) =>
      exchange?.toUpperCase().includes(code === "NYSE" ? "NEW YORK" : code),
    )?.code;

    return {
      ok: true,
      data: {
        symbol: { ...symbol, exchange: exchangeCode ?? symbol.exchange },
        name,
        currency: currency ?? null,
        industry: finnhubIndustry ?? null,
        // Finnhub reports market cap in millions.
        marketCap:
          marketCapitalization == null ? null : marketCapitalization * 1_000_000,
        // A failed metrics call only costs this one field, not the whole profile.
        peRatio: metrics.ok ? (metrics.data.metric?.peTTM ?? null) : null,
        logoUrl: logo || null,
        websiteUrl: weburl || null,
      },
    };
  },

  // Without a company name from the caller, the cached profile supplies it. If that
  // fails too, items are matched on the ticker alone.
  async news(symbol, company): Promise<MarketDataResult<NewsItem[]>> {
    const ticker = encodeURIComponent(symbol.ticker);
    const to = new Date();
    const from = new Date(to.getTime() - NEWS_DAYS * 24 * 60 * 60 * 1000);
    const [result, profile] = await Promise.all([
      request<FinnhubNews>(
        `/company-news?symbol=${ticker}&from=${toDateParam(from)}&to=${toDateParam(to)}`,
        900,
      ),
      company
        ? Promise.resolve(null)
        : request<FinnhubProfile>(`/stock/profile2?symbol=${ticker}`, 86_400),
    ]);
    if (!result.ok) return result;

    const name = company ?? (profile?.ok ? (profile.data.name ?? null) : null);
    const items: NewsItem[] = result.data.map((item) => ({
      headline: item.headline,
      summary: item.summary,
      url: item.url,
      source: item.source,
      imageUrl: item.image || null,
      publishedAt: item.datetime * 1000,
    }));
    return { ok: true, data: filterNews(items, companyAliases(symbol, name)) };
  },
};
