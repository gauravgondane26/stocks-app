export type MarketId = "US" | "IN";

export type StockSymbol = {
  market: MarketId;
  exchange: string;
  ticker: string;
};

export type Quote = {
  symbol: StockSymbol;
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  currency: string;
  asOf: number;
};

export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// Yahoo limits how far back each interval goes: 1m to 7 days, 5m to 60 days.
export type BarRequest =
  | { interval: "1m"; range: "1d" | "5d" }
  | { interval: "5m"; range: "1d" | "5d" | "1mo" | "60d" }
  | { interval: "1d"; range: "1mo" | "3mo" | "6mo" | "1y" | "5y" };

// Closing prices only, for scanning many stocks in a few requests.
export type CloseSeries = {
  points: { time: number; close: number }[];
  price: number | null;
  volume: number | null;
};

export type StockSearchResult = {
  symbol: StockSymbol;
  name: string;
};

export type CompanyProfile = {
  symbol: StockSymbol;
  name: string;
  currency: string | null;
  industry: string | null;
  marketCap: number | null;
  peRatio: number | null;
  logoUrl: string | null;
  websiteUrl: string | null;
};

export type NewsItem = {
  headline: string;
  summary: string;
  url: string;
  source: string;
  imageUrl: string | null;
  publishedAt: number;
};

export type MarketDataFailure = "unavailable" | "not_found" | "not_supported";

// Free data sources fail often, so failure is a normal value that callers must
// handle, shown to users as "data unavailable", rather than an exception.
export type MarketDataResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: MarketDataFailure };

export interface MarketDataProvider {
  search(query: string): Promise<MarketDataResult<StockSearchResult[]>>;
  quote(symbol: StockSymbol): Promise<MarketDataResult<Quote>>;
  bars(
    symbol: StockSymbol,
    request: BarRequest,
  ): Promise<MarketDataResult<Bar[]>>;
  profile(symbol: StockSymbol): Promise<MarketDataResult<CompanyProfile>>;
  // Keyed by ticker. Stocks that failed are missing rather than failing the batch.
  closeSeries(
    symbols: StockSymbol[],
    request: BarRequest,
  ): Promise<MarketDataResult<Record<string, CloseSeries>>>;
  // Recent stories that name the company, newest first. Pass the company name when
  // known (a watchlist entry has it); otherwise the provider looks it up.
  news(symbol: StockSymbol, company?: string): Promise<MarketDataResult<NewsItem[]>>;
}
