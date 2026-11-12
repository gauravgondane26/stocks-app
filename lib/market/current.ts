import "server-only";

import { cookies, headers } from "next/headers";

import { isMarketId, MARKET_COOKIE, marketForCountry } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

// The last market picked in the switcher wins. Otherwise it follows the visitor's
// location: Vercel sets x-vercel-ip-country from their IP. The header is missing in
// local development, so that starts on the US market.
export const getCurrentMarket = async (): Promise<MarketId> => {
  const saved = (await cookies()).get(MARKET_COOKIE)?.value;
  if (isMarketId(saved)) return saved;

  return marketForCountry((await headers()).get("x-vercel-ip-country") ?? undefined);
};
