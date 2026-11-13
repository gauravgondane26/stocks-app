import "server-only";

import { Schema } from "mongoose";

import { getModel } from "@/database/mongoose";
import { MARKET_IDS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

export type WatchlistDocument = {
  userId: string;
  market: MarketId;
  exchange: string;
  ticker: string;
  company: string;
  addedAt: Date;
};

const watchlistSchema = new Schema<WatchlistDocument>(
  {
    userId: { type: String, required: true },
    market: { type: String, enum: MARKET_IDS, required: true },
    exchange: { type: String, required: true },
    ticker: { type: String, required: true },
    company: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

watchlistSchema.index({ userId: 1, market: 1, ticker: 1 }, { unique: true });

export const getWatchlistModel = () => getModel<WatchlistDocument>("Watchlist", watchlistSchema);
