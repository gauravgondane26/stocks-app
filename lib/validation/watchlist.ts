import { isMarketId, MARKETS } from "@/lib/market/markets";
import { parseTicker } from "@/lib/market/symbols";
import type { MarketId, StockSymbol } from "@/lib/market/types";

const COMPANY_MAX_LENGTH = 200;
const INVALID_STOCK = "That stock isn't valid.";

type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string };

export type WatchlistKey = { market: MarketId; ticker: string };
export type WatchlistAddition = StockSymbol & { company: string };

export const validateWatchlistKey = (
  input: unknown,
): ValidationResult<WatchlistKey> => {
  const raw = (input ?? {}) as Record<string, unknown>;
  const ticker = parseTicker(raw.ticker);
  if (!isMarketId(raw.market) || !ticker) {
    return { valid: false, error: INVALID_STOCK };
  }

  return { valid: true, data: { market: raw.market, ticker } };
};

export const validateWatchlistAddition = (
  input: unknown,
): ValidationResult<WatchlistAddition> => {
  const key = validateWatchlistKey(input);
  if (!key.valid) return key;

  const raw = input as Record<string, unknown>;
  const { market } = key.data;
  const exchange = typeof raw.exchange === "string" ? raw.exchange : "";
  const isKnownExchange =
    exchange === MARKETS[market].unresolvedExchange ||
    MARKETS[market].exchanges.some(({ code }) => code === exchange);
  if (!isKnownExchange) return { valid: false, error: INVALID_STOCK };

  const company = typeof raw.company === "string" ? raw.company.trim() : "";
  if (!company || company.length > COMPANY_MAX_LENGTH) {
    return { valid: false, error: INVALID_STOCK };
  }

  return { valid: true, data: { ...key.data, exchange, company } };
};
