import "server-only";

import { finnhubProvider } from "@/lib/market/providers/finnhub";
import { searchNseSymbols } from "@/lib/market/providers/nse-search";
import { yahooProvider } from "@/lib/market/providers/yahoo";
import type { MarketDataProvider, MarketId } from "@/lib/market/types";

const PROVIDERS: Record<MarketId, MarketDataProvider> = {
  US: {
    search: finnhubProvider.search,
    quote: yahooProvider.quote,
    bars: yahooProvider.bars,
    profile: finnhubProvider.profile,
    news: finnhubProvider.news,
  },
  IN: {
    search: searchNseSymbols,
    quote: yahooProvider.quote,
    bars: yahooProvider.bars,
    profile: yahooProvider.profile,
    // Phase 6 chooses an Indian news source.
    news: async () => ({ ok: false, reason: "not_supported" }),
  },
};

// The only way into market data: features never call Finnhub or Yahoo directly,
// so adding a source later only changes this file and one new provider.
export const getMarketData = (market: MarketId): MarketDataProvider =>
  PROVIDERS[market];
