import "server-only";

import mongoose, { Schema, type Model, type Types } from "mongoose";

import { connectToDatabase } from "@/database/mongoose";
import {
  ALERT_TYPES,
  type AlertStatus,
  type AlertType,
} from "@/lib/alerts/types";
import { MARKET_IDS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

export type AlertDocument = {
  _id: Types.ObjectId;
  userId: string;
  market: MarketId;
  exchange: string;
  ticker: string;
  company: string;
  type: AlertType;
  level: number | null;
  pct: number | null;
  time: string | null;
  label: string | null;
  status: AlertStatus;
  rangAt: Date | null;
  rangPrice: number | null;
  createdAt: Date;
};

const alertSchema = new Schema<AlertDocument>(
  {
    userId: { type: String, required: true },
    market: { type: String, enum: MARKET_IDS, required: true },
    exchange: { type: String, required: true },
    ticker: { type: String, required: true },
    company: { type: String, required: true },
    type: { type: String, enum: ALERT_TYPES, required: true },
    level: { type: Number, default: null },
    pct: { type: Number, default: null },
    time: { type: String, default: null },
    label: { type: String, default: null },
    status: {
      type: String,
      enum: ["active", "rang"],
      default: "active",
      required: true,
    },
    rangAt: { type: Date, default: null },
    rangPrice: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

// The first serves the background check, the second each user's alerts list.
alertSchema.index({ status: 1, market: 1 });
alertSchema.index({ userId: 1, market: 1, status: 1 });

export const getAlertModel = async (): Promise<Model<AlertDocument>> => {
  await connectToDatabase();

  const model =
    (mongoose.models.Alert as Model<AlertDocument> | undefined) ??
    mongoose.model<AlertDocument>("Alert", alertSchema);
  await model.init();
  return model;
};
