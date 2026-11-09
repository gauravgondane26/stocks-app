"use server";

import { getCurrentUser } from "@/lib/better-auth/session";
import { allowRequest } from "@/lib/rate-limit";
import { getMarketData } from "@/lib/market";
import { getCurrentMarket } from "@/lib/market/current";
import { POPULAR_STOCKS } from "@/lib/market/popular";
import type { MarketId, StockSearchResult } from "@/lib/market/types";
import { findWatchedTickers } from "@/lib/watchlist";

const MAX_QUERY_LENGTH = 64;
// Finnhub's free plan allows 60 calls a minute across the whole app.
const SEARCHES_PER_MINUTE = 30;
const ONE_MINUTE_MS = 60_000;

// Search still works without the stars if the database is unreachable.
const getWatchedTickers = async (userId: string, market: MarketId) => {
  try {
    return await findWatchedTickers(userId, market);
  } catch (error) {
    console.error("Watchlist lookup failed:", error);
    return new Set<string>();
  }
};

export const searchStocks = async (
  input: unknown,
): Promise<SearchStocksResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  if (typeof input !== "string" || input.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: "That search is too long." };
  }

  const query = input.trim();
  const market = await getCurrentMarket();
  let stocks: StockSearchResult[] = POPULAR_STOCKS[market];

  if (query) {
    if (!allowRequest(`search:${user.id}`, SEARCHES_PER_MINUTE, ONE_MINUTE_MS)) {
      return { ok: false, error: "Too many searches. Wait a moment and try again." };
    }

    const result = await getMarketData(market).search(query);
    if (!result.ok) {
      return { ok: false, error: "Search data is unavailable right now." };
    }
    stocks = result.data;
  }

  const watched = await getWatchedTickers(user.id, market);
  return {
    ok: true,
    stocks: stocks.map((stock) => ({
      ...stock,
      isInWatchlist: watched.has(stock.symbol.ticker),
    })),
  };
};
