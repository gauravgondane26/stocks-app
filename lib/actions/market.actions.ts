"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { isMarketId, MARKET_COOKIE } from "@/lib/market/markets";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const setMarket = async (market: unknown): Promise<void> => {
  if (!isMarketId(market)) return;

  (await cookies()).set(MARKET_COOKIE, market, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
  revalidatePath("/", "layout");
};
