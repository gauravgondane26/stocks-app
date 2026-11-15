// What each service does with one message (or one poll), written against injected
// dependencies so tests can run them with fakes. The service files (producer.ts,
// evaluator.ts, notifier.ts, archiver.ts) wire these to Kafka and MongoDB.
import { ringMessage } from "@/lib/alerts/describe";
import { shouldRing } from "@/lib/alerts/evaluate";
import type { AlertRule, MarketClock } from "@/lib/alerts/types";
import { getMarketClock, isMarketOpen } from "@/lib/market/hours";
import type { MarketDataResult, MarketId, Quote, StockSymbol } from "@/lib/market/types";

import {
  parseQuoteMessage,
  parseRingingMessage,
  quoteKey,
  type QuoteMessage,
  type RingingMessage,
} from "./messages";
import { isFromToday, toQuoteMessage } from "./quotes";

// ---------------------------------------------------------------------------
// Commit after processing

export type Committable = { commit(): void | Promise<void> };

// At-least-once delivery: the offset is committed only after the handler (and any
// message it produces) has finished. If the process dies in between, the message is
// read again, which is why every handler is safe to run twice.
export const processThenCommit = async <M extends Committable>(
  message: M,
  handle: (message: M) => Promise<unknown>,
) => {
  await handle(message);
  await message.commit();
};

// ---------------------------------------------------------------------------
// Producer: one poll of one market

export const QUOTE_BATCH_SIZE = 5;
export const QUOTE_BATCH_PAUSE_MS = 500;

export type PollDeps = {
  loadSymbols: (market: MarketId) => Promise<StockSymbol[]>;
  fetchQuote: (symbol: StockSymbol) => Promise<MarketDataResult<Quote>>;
  publish: (messages: QuoteMessage[]) => Promise<void>;
  pause: (ms: number) => Promise<void>;
  now: () => Date;
};

export type PollResult = {
  symbols: number;
  published: number;
  failed: number;
  stale: number;
};

// Same pace as lib/alerts/check.ts: batches of 5 with a pause, to go easy on Yahoo.
// Failed and stale (not today's) quotes are counted and skipped.
export const pollMarket = async (market: MarketId, deps: PollDeps): Promise<PollResult> => {
  const symbols = await deps.loadSymbols(market);
  const result: PollResult = { symbols: symbols.length, published: 0, failed: 0, stale: 0 };

  for (let start = 0; start < symbols.length; start += QUOTE_BATCH_SIZE) {
    if (start > 0) await deps.pause(QUOTE_BATCH_PAUSE_MS);
    const batch = symbols.slice(start, start + QUOTE_BATCH_SIZE);
    const quotes = await Promise.all(batch.map((symbol) => deps.fetchQuote(symbol)));

    const polledAt = deps.now();
    const messages: QuoteMessage[] = [];
    for (const quote of quotes) {
      if (!quote.ok) result.failed += 1;
      else if (!isFromToday(market, quote.data.asOf, polledAt)) result.stale += 1;
      else messages.push(toQuoteMessage(quote.data, polledAt.getTime(), "live"));
    }

    if (messages.length > 0) await deps.publish(messages);
    result.published += messages.length;
  }
  return result;
};

// ---------------------------------------------------------------------------
// Evaluator: quote -> rings

export type ActiveAlert = AlertRule & {
  id: string;
  exchange: string;
  ticker: string;
  label: string | null;
};

export type MessageOrigin = { topic: string; partition: number; offset: string };

export type EvaluatorDeps = {
  alertsFor: (market: MarketId, exchange: string, ticker: string) => Promise<ActiveAlert[]>;
  produceRing: (ring: RingingMessage) => Promise<void>;
  sendToDlq: (raw: string | undefined, error: string, origin: MessageOrigin) => Promise<void>;
  // Alerts already sent to alerts.ringing by this process, so a price that stays past
  // its level rings once, not on every quote. Keyed by source, market date and alert.
  alreadyRung: Set<string>;
};

export type EvaluateResult =
  | { kind: "dead-lettered"; error: string }
  | { kind: "evaluated"; rang: string[] };

// The clock comes from the quote's own time, so a replayed 10:35 bar evaluates as
// 10:35 that day. Price rules don't read the clock; ringMessage only uses it for text.
const clockFor = (market: MarketId, at: Date): MarketClock => ({
  isOpen: isMarketOpen(market, at),
  time: getMarketClock(market, at).time,
});

export const handleQuote = async (
  raw: string | undefined,
  origin: MessageOrigin,
  deps: EvaluatorDeps,
): Promise<EvaluateResult> => {
  const parsed = parseQuoteMessage(raw);
  if (!parsed.ok) {
    await deps.sendToDlq(raw, parsed.error, origin);
    return { kind: "dead-lettered", error: parsed.error };
  }

  const quote = parsed.value;
  const at = new Date(quote.asOf);
  const clock = clockFor(quote.market, at);
  const date = getMarketClock(quote.market, at).date;
  const alerts = await deps.alertsFor(quote.market, quote.exchange, quote.ticker);
  const rang: string[] = [];

  for (const alert of alerts) {
    const key = `${quote.source}:${date}:${alert.id}`;
    if (deps.alreadyRung.has(key)) continue;
    if (!shouldRing(alert, quote, clock)) continue;

    await deps.produceRing({
      alertId: alert.id,
      price: quote.price,
      message: ringMessage(alert, quote.ticker, quote.market, quote, clock),
      quoteAsOf: quote.asOf,
      source: quote.source,
    });
    deps.alreadyRung.add(key);
    rang.push(alert.id);
  }
  return { kind: "evaluated", rang };
};

// Active alerts for a market, loaded at most once per `ttlMs` and grouped by stock.
// Price rules only: time and opening-bell alerts stay with Inngest.
export const createAlertCache = (
  load: (market: MarketId) => Promise<ActiveAlert[]>,
  ttlMs: number,
  now: () => number = Date.now,
) => {
  const cache = new Map<MarketId, { loadedAt: number; byStock: Map<string, ActiveAlert[]> }>();

  return async (market: MarketId, exchange: string, ticker: string) => {
    let entry = cache.get(market);
    if (!entry || now() - entry.loadedAt >= ttlMs) {
      const byStock = new Map<string, ActiveAlert[]>();
      for (const alert of await load(market)) {
        if (alert.type === "time" || alert.type === "opening_bell") continue;
        const key = quoteKey(alert);
        byStock.set(key, [...(byStock.get(key) ?? []), alert]);
      }
      entry = { loadedAt: now(), byStock };
      cache.set(market, entry);
    }
    return entry.byStock.get(quoteKey({ exchange, ticker })) ?? [];
  };
};

// ---------------------------------------------------------------------------
// Notifier: ring -> log (dry run) or ringAlert

export type NotifierDeps = {
  // PIPELINE_RING_ALERTS=true. Off by default: production Inngest already rings alerts.
  ringForReal: boolean;
  ring: (candidate: { alertId: string; price: number | null; message: string }) => Promise<boolean>;
  log: (line: string) => void;
};

export type NotifyResult = "invalid" | "dry-run" | "rang" | "already-rang";

export const handleRinging = async (
  raw: string | undefined,
  deps: NotifierDeps,
): Promise<NotifyResult> => {
  const parsed = parseRingingMessage(raw);
  if (!parsed.ok) {
    deps.log(`skipped an invalid ring: ${parsed.error}`);
    return "invalid";
  }
  const { alertId, price, message, source } = parsed.value;

  // A replayed session is history: it never rings a real alert, whatever the flag says.
  if (!deps.ringForReal || source === "replay") {
    deps.log(`would ring ${alertId}${source === "replay" ? " (replay)" : ""}: ${message}`);
    return "dry-run";
  }

  // ringAlert only claims an alert that is still active, so a redelivered message, or
  // one that Inngest already rang, comes back false and notifies nobody.
  const rang = await deps.ring({ alertId, price, message });
  deps.log(rang ? `rang ${alertId}: ${message}` : `${alertId} had already rung`);
  return rang ? "rang" : "already-rang";
};

// ---------------------------------------------------------------------------
// Archiver: quote -> openwatch_pipeline

export type ArchiverDeps = {
  // Live quotes only, so a replay never replaces current prices with old ones.
  upsertLatest: (quote: QuoteMessage) => Promise<void>;
  // Every quote, idempotent on (stock, asOf, source), stamped with when it was written.
  appendIntraday: (quote: QuoteMessage, archivedAt: Date) => Promise<void>;
  now: () => Date;
};

export type ArchiveResult = "invalid" | "archived";

// Invalid messages are only skipped here: the evaluator, reading the same topics,
// is the one that sends them to quotes.dlq, so each lands there once.
export const handleArchive = async (
  raw: string | undefined,
  deps: ArchiverDeps,
): Promise<ArchiveResult> => {
  const parsed = parseQuoteMessage(raw);
  if (!parsed.ok) return "invalid";

  const quote = parsed.value;
  await deps.appendIntraday(quote, deps.now());
  if (quote.source === "live") await deps.upsertLatest(quote);
  return "archived";
};
