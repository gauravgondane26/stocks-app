import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import { connectToDatabase } from "@/database/mongoose";
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

// Compiled after connecting because `bufferCommands` is off, and `init` waits for the
// unique index so that a first write can't slip in before it exists.
export const getWatchlistModel = async (): Promise<Model<WatchlistDocument>> => {
  await connectToDatabase();

  const model =
    (mongoose.models.Watchlist as Model<WatchlistDocument> | undefined) ??
    mongoose.model<WatchlistDocument>("Watchlist", watchlistSchema);
  await model.init();
  return model;
};
