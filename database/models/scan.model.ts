import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import { connectToDatabase } from "@/database/mongoose";
import { MARKET_IDS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import type { DailyHit, OrbHit } from "@/lib/trade/scanner";

export type ScanMode = "daily" | "orb";

export type ScanDocument = {
  market: MarketId;
  mode: ScanMode;
  // Null for a scheduled scan, the user's id for one they ran themselves.
  userId: string | null;
  // The market date the data is for, and the cutoff time for a breakout scan.
  dataDate: string | null;
  cutoff: string | null;
  universe: { index: string; size: number };
  counts: Record<string, number>;
  hits: (DailyHit | OrbHit)[];
  createdAt: Date;
};

const scanSchema = new Schema<ScanDocument>(
  {
    market: { type: String, enum: MARKET_IDS, required: true },
    mode: { type: String, enum: ["daily", "orb"], required: true },
    userId: { type: String, default: null },
    dataDate: { type: String, default: null },
    cutoff: { type: String, default: null },
    universe: { index: String, size: Number },
    counts: { type: Schema.Types.Mixed, default: {} },
    // Stored as plain data: hits are written once by the scan and only read after.
    hits: { type: Schema.Types.Mixed, default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

scanSchema.index({ market: 1, mode: 1, userId: 1, createdAt: -1 });
// Old scans are only history, so they expire after two weeks.
scanSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

export const getScanModel = async (): Promise<Model<ScanDocument>> => {
  await connectToDatabase();

  const model =
    (mongoose.models.Scan as Model<ScanDocument> | undefined) ??
    mongoose.model<ScanDocument>("Scan", scanSchema);
  await model.init();
  return model;
};
