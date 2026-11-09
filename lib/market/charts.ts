import "server-only";

import { getMarketData } from "@/lib/market";
import { findExchange } from "@/lib/market/symbols";
import type { StockSymbol } from "@/lib/market/types";

export type ChartListing = {
  available: boolean;
  // Set when the charts show a different listing from the one quotes come from.
  otherExchange: string | null;
};

// TradingView embeds show the BSE listing of NSE stocks, and an NSE-only stock would
// show an error inside the widget where the app can't detect it. So check the other
// listing first. Only a definite "not found" hides the charts, not an outage.
export const getChartListing = async (
  symbol: StockSymbol,
): Promise<ChartListing> => {
  const exchange = findExchange(symbol);
  if (!exchange || exchange.code === exchange.tradingViewPrefix) {
    return { available: true, otherExchange: null };
  }

  const otherExchange = exchange.tradingViewPrefix;
  const quote = await getMarketData(symbol.market).quote({
    ...symbol,
    exchange: otherExchange,
  });

  return { available: quote.ok || quote.reason !== "not_found", otherExchange };
};
