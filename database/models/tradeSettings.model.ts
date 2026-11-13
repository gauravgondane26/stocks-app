import "server-only";

import { Schema } from "mongoose";

import { getModel } from "@/database/mongoose";
import { MARKET_IDS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import type { TradeSettings } from "@/lib/trade/settings";

export type TradeSettingsDocument = TradeSettings & {
  userId: string;
  market: MarketId;
  updatedAt: Date;
};

const tradeSettingsSchema = new Schema<TradeSettingsDocument>(
  {
    userId: { type: String, required: true },
    market: { type: String, enum: MARKET_IDS, required: true },
    accountSize: { type: Number, default: null },
    maxLossPerTrade: { type: Number, default: null },
    maxDailyLoss: { type: Number, default: null },
    maxTradesPerDay: { type: Number, required: true },
    minRewardRisk: { type: Number, required: true },
    noEntriesBefore: { type: String, required: true },
    noEntriesAfter: { type: String, required: true },
    flatBy: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

// One set per market, since amounts are in each market's currency.
tradeSettingsSchema.index({ userId: 1, market: 1 }, { unique: true });

export const getTradeSettingsModel = () => getModel<TradeSettingsDocument>("TradeSettings", tradeSettingsSchema);
