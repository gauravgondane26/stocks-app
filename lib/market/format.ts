import { MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

export const formatMoney = (value: number, market: MarketId): string => {
  const { locale, currency } = MARKETS[market];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value);
};

export const formatCompactMoney = (value: number, market: MarketId): string => {
  const { locale, currency } = MARKETS[market];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatPercent = (value: number): string =>
  `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
