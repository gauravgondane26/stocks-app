import { MARKETS, type ExchangeConfig } from "@/lib/market/markets";
import type { StockSymbol } from "@/lib/market/types";

const findExchange = (symbol: StockSymbol): ExchangeConfig | undefined =>
  MARKETS[symbol.market].exchanges.find(
    (exchange) => exchange.code === symbol.exchange,
  );

// US search results don't say which exchange a ticker is on, so `exchange` can be
// unknown. TradingView resolves a bare US ticker, so leave the prefix off then.
export const toTradingView = (symbol: StockSymbol): string => {
  const exchange = findExchange(symbol);
  return exchange
    ? `${exchange.tradingViewPrefix}:${symbol.ticker}`
    : symbol.ticker;
};

export const toYahoo = (symbol: StockSymbol): string => {
  const suffix =
    findExchange(symbol)?.yahooSuffix ??
    MARKETS[symbol.market].exchanges[0].yahooSuffix;
  return `${symbol.ticker}${suffix}`;
};
