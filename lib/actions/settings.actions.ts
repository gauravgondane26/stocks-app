"use server";

import { revalidatePath } from "next/cache";

import { getTradeSettingsModel } from "@/database/models/tradeSettings.model";
import { getCurrentUser, requireUser } from "@/lib/better-auth/session";
import { isMarketId } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import {
  defaultTradeSettings,
  type TradeSettings,
} from "@/lib/trade/settings";
import { validateTradeSettings } from "@/lib/validation/tradeSettings";

// Falls back to the defaults, marked unsaved, so a database problem doesn't break the page.
export const getTradeSettings = async (
  market: unknown,
): Promise<{ settings: TradeSettings; saved: boolean }> => {
  const user = await requireUser();
  const marketId: MarketId = isMarketId(market) ? market : "US";
  const defaults = defaultTradeSettings(marketId);

  try {
    const Settings = await getTradeSettingsModel();
    const saved = await Settings.findOne({ userId: user.id, market: marketId }).lean();
    if (!saved) return { settings: defaults, saved: false };

    return {
      saved: true,
      settings: {
        accountSize: saved.accountSize,
        maxLossPerTrade: saved.maxLossPerTrade,
        maxDailyLoss: saved.maxDailyLoss,
        maxTradesPerDay: saved.maxTradesPerDay,
        minRewardRisk: saved.minRewardRisk,
        noEntriesBefore: saved.noEntriesBefore,
        noEntriesAfter: saved.noEntriesAfter,
        flatBy: saved.flatBy,
      },
    };
  } catch (error) {
    console.error("Load trade settings failed:", error);
    return { settings: defaults, saved: false };
  }
};

export const saveTradeSettings = async (
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const result = validateTradeSettings(input);
  if (!result.valid) return { ok: false, error: result.error };
  const { market, ...settings } = result.data;

  try {
    const Settings = await getTradeSettingsModel();
    await Settings.updateOne(
      { userId: user.id, market },
      { $set: { ...settings, updatedAt: new Date() } },
      { upsert: true },
    );
  } catch (error) {
    console.error("Save trade settings failed:", error);
    return { ok: false, error: "Couldn't save your settings. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/stocks/[market]/[ticker]", "page");
  return { ok: true };
};
