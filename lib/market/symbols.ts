import {
  isMarketId,
  MARKETS,
  type ExchangeConfig,
} from "@/lib/market/markets";
import type { MarketId, StockSymbol } from "@/lib/market/types";

// Covers NSE tickers such as M&M and BAJAJ-AUTO, and US share classes such as BRK.B.
const TICKER_PATTERN = /^[A-Z0-9&.-]{1,20}$/;

export const findExchange = (symbol: StockSymbol): ExchangeConfig | undefined =>
  MARKETS[symbol.market].exchanges.find(
    (exchange) => exchange.code === symbol.exchange,
  );

// US search results don't say which exchange a ticker is on, so `exchange` can be
// unknown. TradingView resolves a bare US ticker, so leave the prefix off then.
export const toTradingView = (symbol: StockSymbol): string => {
  const exchange = findExchange(symbol);
  // TradingView writes M&M as M_M and BAJAJ-AUTO as BAJAJ_AUTO.
  const ticker = symbol.ticker.replace(/[&-]/g, "_");
  return exchange ? `${exchange.tradingViewPrefix}:${ticker}` : ticker;
};

// Yahoo writes a share class with a dash: BRK.B is BRK-B. Indian tickers have no dots.
export const toYahoo = (symbol: StockSymbol): string => {
  const suffix =
    findExchange(symbol)?.yahooSuffix ??
    MARKETS[symbol.market].exchanges[0].yahooSuffix;
  return `${symbol.ticker.replace(/\./g, "-")}${suffix}`;
};

export const parseTicker = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const ticker = value.trim().toUpperCase();
  return TICKER_PATTERN.test(ticker) ? ticker : null;
};

// Tickers like M&M have to be escaped to survive in a URL.
export const stockPath = ({
  market,
  ticker,
}: {
  market: MarketId;
  ticker: string;
}): string => `/stocks/${market}/${encodeURIComponent(ticker)}`;

const decodeParam = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

// Route params arrive still URL-encoded. Null means the URL isn't a valid stock.
export const symbolFromRoute = (
  marketParam: string,
  tickerParam: string,
): StockSymbol | null => {
  const market = marketParam.toUpperCase();
  const ticker = parseTicker(decodeParam(tickerParam));
  if (!isMarketId(market) || !ticker) return null;

  return { market, exchange: MARKETS[market].unresolvedExchange, ticker };
};
