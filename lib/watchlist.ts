import "server-only";

import { getWatchlistModel } from "@/database/models/watchlist.model";
import type { MarketId } from "@/lib/market/types";

// These take a user id, so they must never be exported from a "use server" file,
// where any client could call them with someone else's id.
export const findWatchlist = async (
  userId: string,
  market: MarketId,
): Promise<WatchlistEntry[]> => {
  const Watchlist = await getWatchlistModel();
  const documents = await Watchlist.find({ userId, market })
    .sort({ addedAt: -1 })
    .lean();

  return documents.map(({ market, exchange, ticker, company, addedAt }) => ({
    symbol: { market, exchange, ticker },
    company,
    addedAt: addedAt.getTime(),
  }));
};

export const findWatchedTickers = async (
  userId: string,
  market: MarketId,
): Promise<Set<string>> => {
  const Watchlist = await getWatchlistModel();
  const documents = await Watchlist.find({ userId, market })
    .select({ ticker: 1 })
    .lean();

  return new Set(documents.map(({ ticker }) => ticker));
};
