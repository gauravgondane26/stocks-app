import {
  alertValueKind,
  isAlertType,
  type AlertRule,
} from "@/lib/alerts/types";
import { MARKETS } from "@/lib/market/markets";
import type { StockSymbol } from "@/lib/market/types";
import { validateWatchlistAddition } from "@/lib/validation/watchlist";

const LABEL_MAX_LENGTH = 80;
const MAX_LEVEL = 1_000_000_000;
const MAX_PCT = 1000;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string };

export type AlertInput = StockSymbol &
  AlertRule & { company: string; label: string | null };

const toPositiveNumber = (value: unknown, max: number): number | null => {
  const number = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(number) && number > 0 && number <= max ? number : null;
};

export const validateAlert = (input: unknown): ValidationResult<AlertInput> => {
  const stock = validateWatchlistAddition(input);
  if (!stock.valid) return stock;

  const raw = input as Record<string, unknown>;
  if (!isAlertType(raw.type)) {
    return { valid: false, error: "Choose an alert type." };
  }

  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (label.length > LABEL_MAX_LENGTH) {
    return { valid: false, error: "That label is too long." };
  }

  const alert: AlertInput = {
    ...stock.data,
    type: raw.type,
    level: null,
    pct: null,
    time: null,
    label: label || null,
  };

  const kind = alertValueKind(raw.type);
  if (kind === "level") {
    alert.level = toPositiveNumber(raw.level, MAX_LEVEL);
    if (alert.level === null) {
      return { valid: false, error: "Enter a price above zero." };
    }
  }
  if (kind === "pct") {
    alert.pct = toPositiveNumber(raw.pct, MAX_PCT);
    if (alert.pct === null) {
      return { valid: false, error: "Enter a percentage above zero." };
    }
  }
  if (kind === "time") {
    const { open, close } = MARKETS[alert.market];
    const time = typeof raw.time === "string" ? raw.time : "";
    // Alerts are only checked while the market is open, so later times never ring.
    if (!TIME_PATTERN.test(time) || time < open || time >= close) {
      return {
        valid: false,
        error: `Choose a time from ${open} up to ${close}, market time.`,
      };
    }
    alert.time = time;
  }

  return { valid: true, data: alert };
};

export const isValidAlertId = (id: unknown): id is string =>
  typeof id === "string" && OBJECT_ID_PATTERN.test(id);
