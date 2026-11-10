import { isMarketId, MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import type { TradeSettings } from "@/lib/trade/settings";

const MAX_MONEY = 1_000_000_000_000;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string };

// Empty means "not set". Anything else must be a positive amount.
const optionalMoney = (value: unknown): number | null | undefined => {
  if (value === null || value === "" || value === undefined) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 && number <= MAX_MONEY
    ? number
    : undefined;
};

export const validateTradeSettings = (
  input: unknown,
): ValidationResult<TradeSettings & { market: MarketId }> => {
  const raw = (input ?? {}) as Record<string, unknown>;
  if (!isMarketId(raw.market)) return { valid: false, error: "Choose a market." };
  const market = raw.market;

  const accountSize = optionalMoney(raw.accountSize);
  const maxLossPerTrade = optionalMoney(raw.maxLossPerTrade);
  const maxDailyLoss = optionalMoney(raw.maxDailyLoss);
  if (accountSize === undefined || maxLossPerTrade === undefined || maxDailyLoss === undefined) {
    return { valid: false, error: "Money amounts must be above zero, or left empty." };
  }

  const maxTradesPerDay = Number(raw.maxTradesPerDay);
  if (!Number.isInteger(maxTradesPerDay) || maxTradesPerDay < 1 || maxTradesPerDay > 100) {
    return { valid: false, error: "Max trades a day must be a whole number from 1 to 100." };
  }

  const minRewardRisk = Number(raw.minRewardRisk);
  if (!Number.isFinite(minRewardRisk) || minRewardRisk < 0 || minRewardRisk > 20) {
    return { valid: false, error: "Minimum reward to risk must be from 0 to 20." };
  }

  const times = [raw.noEntriesBefore, raw.noEntriesAfter, raw.flatBy];
  if (!times.every((time) => typeof time === "string" && TIME_PATTERN.test(time))) {
    return { valid: false, error: "Enter times as HH:MM." };
  }
  const [noEntriesBefore, noEntriesAfter, flatBy] = times as string[];
  const { open, close } = MARKETS[market];
  // "HH:MM" strings compare correctly as text.
  if (noEntriesBefore < open || noEntriesAfter > close || noEntriesBefore >= noEntriesAfter) {
    return {
      valid: false,
      error: `The entry window must fall between ${open} and ${close}, start first.`,
    };
  }
  if (flatBy <= noEntriesBefore || flatBy >= close) {
    return {
      valid: false,
      error: `Flat-by must be after the window opens and before the ${close} close.`,
    };
  }

  return {
    valid: true,
    data: {
      market,
      accountSize,
      maxLossPerTrade,
      maxDailyLoss,
      maxTradesPerDay,
      minRewardRisk,
      noEntriesBefore,
      noEntriesAfter,
      flatBy,
    },
  };
};
