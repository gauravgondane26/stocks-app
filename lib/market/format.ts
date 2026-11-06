import { MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

export const formatMoney = (value: number, market: MarketId): string => {
  const { locale, currency } = MARKETS[market];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value);
};
