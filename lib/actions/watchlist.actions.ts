"use server";

import { revalidatePath } from "next/cache";

import { getWatchlistModel } from "@/database/models/watchlist.model";
import { getCurrentUser, requireUser } from "@/lib/better-auth/session";
import { isMarketId } from "@/lib/market/markets";
import {
  validateWatchlistAddition,
  validateWatchlistKey,
} from "@/lib/validation/watchlist";
import { findWatchedTickers, findWatchlist } from "@/lib/watchlist";

const GENERIC_ERROR = "Couldn't update your watchlist. Please try again.";
const SIGNED_OUT_ERROR = "Please sign in again.";
const DUPLICATE_KEY_CODE = 11000;

const refreshWatchlistPages = () => {
  revalidatePath("/watchlist");
  revalidatePath("/stocks/[market]/[ticker]", "page");
};

const isDuplicateKeyError = (error: unknown): boolean =>
  (error as { code?: number } | null)?.code === DUPLICATE_KEY_CODE;

export const addToWatchlist = async (
  input: unknown,
): Promise<WatchlistActionResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT_ERROR };

  const result = validateWatchlistAddition(input);
  if (!result.valid) return { ok: false, error: result.error };
  const { market, ticker, exchange, company } = result.data;

  try {
    const Watchlist = await getWatchlistModel();
    await Watchlist.updateOne(
      { userId: user.id, market, ticker },
      { $setOnInsert: { exchange, company, addedAt: new Date() } },
      { upsert: true },
    );
  } catch (error) {
    // Two overlapping adds can race on the unique index, and the stock is saved either way.
    if (!isDuplicateKeyError(error)) {
      console.error("Add to watchlist failed:", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  refreshWatchlistPages();
  return { ok: true };
};

export const removeFromWatchlist = async (
  input: unknown,
): Promise<WatchlistActionResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT_ERROR };

  const result = validateWatchlistKey(input);
  if (!result.valid) return { ok: false, error: result.error };

  try {
    const Watchlist = await getWatchlistModel();
    await Watchlist.deleteOne({ userId: user.id, ...result.data });
  } catch (error) {
    console.error("Remove from watchlist failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  refreshWatchlistPages();
  return { ok: true };
};

export const getWatchlist = async (
  market: unknown,
): Promise<WatchlistReadResult> => {
  const user = await requireUser();
  if (!isMarketId(market)) return { ok: false };

  try {
    return { ok: true, data: await findWatchlist(user.id, market) };
  } catch (error) {
    console.error("Load watchlist failed:", error);
    return { ok: false };
  }
};

// A database failure reads as "not watched" so the stock page can still load.
export const isInWatchlist = async (input: unknown): Promise<boolean> => {
  const user = await requireUser();

  const result = validateWatchlistKey(input);
  if (!result.valid) return false;

  try {
    const tickers = await findWatchedTickers(user.id, result.data.market);
    return tickers.has(result.data.ticker);
  } catch (error) {
    console.error("Watchlist lookup failed:", error);
    return false;
  }
};
