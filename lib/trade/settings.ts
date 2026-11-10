import { MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

export type TradeSettings = {
  // Money is in the market's own currency, and null until the person sets it, so the
  // app never sizes a trade from a guessed amount.
  accountSize: number | null;
  maxLossPerTrade: number | null;
  maxDailyLoss: number | null;
  maxTradesPerDay: number;
  minRewardRisk: number;
  noEntriesBefore: string;
  noEntriesAfter: string;
  flatBy: string;
};

export const defaultTradeSettings = (market: MarketId): TradeSettings => ({
  accountSize: null,
  maxLossPerTrade: null,
  maxDailyLoss: null,
  maxTradesPerDay: 3,
  minRewardRisk: 1,
  ...MARKETS[market].tradeDefaults,
});
