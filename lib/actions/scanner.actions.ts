"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/better-auth/session";
import { getCurrentMarket } from "@/lib/market/current";
import { allowRequest } from "@/lib/rate-limit";
import { buildUniverse, runScan, saveScan } from "@/lib/scanner";
import { findWatchlist } from "@/lib/watchlist";

// A scan fetches hundreds of charts, so a person can run a few every 10 minutes.
const SCANS_PER_WINDOW = 3;
const WINDOW_MS = 10 * 60_000;

export const runScanNow = async (
  mode: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (mode !== "daily" && mode !== "orb") return { ok: false, error: "Choose a scan." };

  if (!allowRequest(`scan:${user.id}`, SCANS_PER_WINDOW, WINDOW_MS)) {
    return { ok: false, error: "That's a lot of scans. Wait a few minutes and try again." };
  }

  const market = await getCurrentMarket();
  try {
    const watchlist = await findWatchlist(user.id, market);
    const universe = buildUniverse(
      market,
      watchlist.map(({ symbol, company }) => ({ ticker: symbol.ticker, name: company })),
    );
    const outcome = await runScan(market, mode, universe);
    if (!outcome.ok) return { ok: false, error: `The scan can't run now: ${outcome.reason}.` };
    await saveScan(outcome.scan, user.id);
  } catch (error) {
    console.error("Scan failed:", error);
    return { ok: false, error: "The scan failed. Please try again." };
  }

  revalidatePath("/scanner");
  return { ok: true };
};
