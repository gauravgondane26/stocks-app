// The JSON messages on the pipeline's topics, with encoding and validation. Pure: no
// Kafka, database or network, so the root Vitest suite can test it.
import { isMarketId } from "@/lib/market/markets";
import type { MarketId, StockSymbol } from "@/lib/market/types";

// "replay" quotes come from a past session (pipeline/worker/src/replay.ts). They flow
// through the same topics but must never ring a real alert or overwrite current prices.
export type QuoteSource = "live" | "replay";

export type QuoteMessage = {
  market: MarketId;
  exchange: string;
  ticker: string;
  price: number;
  previousClose: number | null;
  // When the price was current (ms since epoch), and when the producer fetched it.
  asOf: number;
  polledAt: number;
  source: QuoteSource;
};

export type RingingMessage = {
  alertId: string;
  price: number | null;
  message: string;
  quoteAsOf: number | null;
  source: QuoteSource;
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_TICKER_LENGTH = 30;
const MAX_MESSAGE_LENGTH = 1000;
const ALERT_ID_PATTERN = /^[0-9a-f]{24}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isTimestamp = (value: unknown): value is number =>
  isPositive(value) && Number.isInteger(value);

const isShortText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

const isSource = (value: unknown): value is QuoteSource =>
  value === "live" || value === "replay";

const parseJson = (raw: string | undefined): ParseResult<Record<string, unknown>> => {
  if (!raw) return { ok: false, error: "empty message" };
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value) ? { ok: true, value } : { ok: false, error: "not a JSON object" };
  } catch {
    return { ok: false, error: "not valid JSON" };
  }
};

export const encodeMessage = (message: QuoteMessage | RingingMessage) =>
  JSON.stringify(message);

// Partition key: one stock always lands on the same partition, which keeps its quotes
// in order for every consumer.
export const quoteKey = ({ exchange, ticker }: Pick<StockSymbol, "exchange" | "ticker">) =>
  `${exchange}:${ticker}`;

export const parseQuoteMessage = (raw: string | undefined): ParseResult<QuoteMessage> => {
  const json = parseJson(raw);
  if (!json.ok) return json;
  const m = json.value;

  if (!isMarketId(m.market)) return { ok: false, error: "unknown market" };
  if (!isShortText(m.exchange, MAX_TICKER_LENGTH)) return { ok: false, error: "missing exchange" };
  if (!isShortText(m.ticker, MAX_TICKER_LENGTH)) return { ok: false, error: "missing ticker" };
  if (!isPositive(m.price)) return { ok: false, error: "price must be a positive number" };
  if (m.previousClose !== null && !isPositive(m.previousClose)) {
    return { ok: false, error: "previousClose must be a positive number or null" };
  }
  if (!isTimestamp(m.asOf) || !isTimestamp(m.polledAt)) {
    return { ok: false, error: "asOf and polledAt must be millisecond timestamps" };
  }
  if (!isSource(m.source)) return { ok: false, error: "source must be live or replay" };

  return {
    ok: true,
    value: {
      market: m.market,
      exchange: m.exchange,
      ticker: m.ticker,
      price: m.price,
      previousClose: m.previousClose,
      asOf: m.asOf,
      polledAt: m.polledAt,
      source: m.source,
    },
  };
};

export const parseRingingMessage = (raw: string | undefined): ParseResult<RingingMessage> => {
  const json = parseJson(raw);
  if (!json.ok) return json;
  const m = json.value;

  if (typeof m.alertId !== "string" || !ALERT_ID_PATTERN.test(m.alertId)) {
    return { ok: false, error: "alertId must be a Mongo ObjectId" };
  }
  if (m.price !== null && !isPositive(m.price)) {
    return { ok: false, error: "price must be a positive number or null" };
  }
  if (!isShortText(m.message, MAX_MESSAGE_LENGTH)) return { ok: false, error: "missing message" };
  if (m.quoteAsOf !== null && !isTimestamp(m.quoteAsOf)) {
    return { ok: false, error: "quoteAsOf must be a millisecond timestamp or null" };
  }
  if (!isSource(m.source)) return { ok: false, error: "source must be live or replay" };

  return {
    ok: true,
    value: {
      alertId: m.alertId,
      price: m.price,
      message: m.message,
      quoteAsOf: m.quoteAsOf,
      source: m.source,
    },
  };
};
