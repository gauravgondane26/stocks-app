import "server-only";

import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/better-auth/session";
import { isMarketId, MARKET_COOKIE, marketForCountry } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

// The user's last choice wins, otherwise the market follows their sign-up country.
export const getCurrentMarket = async (): Promise<MarketId> => {
  const saved = (await cookies()).get(MARKET_COOKIE)?.value;
  if (isMarketId(saved)) return saved;

  const user = await getCurrentUser();
  return marketForCountry(user?.country);
};
