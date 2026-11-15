// The worker's database access. It reads the app's `openwatch` database (alerts and
// watchlists, through the app's own models) and writes only to `openwatch_pipeline`
// on the same cluster, so the app's data is never changed here.
import type { Collection, Db } from "mongodb";

import { getAlertModel } from "@/database/models/alert.model";
import { getWatchlistModel } from "@/database/models/watchlist.model";
import { connectToDatabase } from "@/database/mongoose";
import type { MarketId, StockSymbol } from "@/lib/market/types";

import type { ActiveAlert } from "./handlers";
import type { QuoteMessage } from "./messages";
import { symbolsToPoll } from "./quotes";

const PIPELINE_DB = "openwatch_pipeline";
const INTRADAY_TTL_SECONDS = 7 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Reads from the app

export const loadActiveAlerts = async (market: MarketId): Promise<ActiveAlert[]> => {
  const Alert = await getAlertModel();
  const alerts = await Alert.find({ status: "active", market }).lean();
  return alerts.map((alert) => ({
    id: alert._id.toString(),
    exchange: alert.exchange,
    ticker: alert.ticker,
    type: alert.type,
    level: alert.level,
    pct: alert.pct,
    time: alert.time,
    label: alert.label,
  }));
};

export const loadPollSymbols = async (market: MarketId): Promise<StockSymbol[]> => {
  const [Alert, Watchlist] = await Promise.all([getAlertModel(), getWatchlistModel()]);
  const [alerts, watchlist] = await Promise.all([
    Alert.find({ status: "active", market }, { exchange: 1, ticker: 1, type: 1 }).lean(),
    Watchlist.find({ market }, { exchange: 1, ticker: 1 }).lean(),
  ]);
  return symbolsToPoll(market, alerts, watchlist);
};

// ---------------------------------------------------------------------------
// Writes to openwatch_pipeline

type LatestQuote = QuoteMessage & { updatedAt: Date };
type IntradayQuote = QuoteMessage & { archivedAt: Date };

export type PipelineCollections = {
  latest: Collection<LatestQuote>;
  intraday: Collection<IntradayQuote>;
};

let collections: Promise<PipelineCollections> | null = null;

const openCollections = async (): Promise<PipelineCollections> => {
  const { connection } = await connectToDatabase();
  const db: Db = connection.getClient().db(PIPELINE_DB);
  const latest = db.collection<LatestQuote>("latest_quotes");
  const intraday = db.collection<IntradayQuote>("intraday_quotes");

  await Promise.all([
    latest.createIndex({ market: 1, exchange: 1, ticker: 1 }, { unique: true }),
    // The unique key makes a redelivered message a no-op instead of a duplicate row.
    intraday.createIndex(
      { market: 1, exchange: 1, ticker: 1, asOf: 1, source: 1 },
      { unique: true },
    ),
    // Expires on the write time, not asOf, so a replayed old session isn't deleted
    // the moment it arrives. Phase 8b's reconcile step reads this collection.
    intraday.createIndex({ archivedAt: 1 }, { expireAfterSeconds: INTRADAY_TTL_SECONDS }),
  ]);
  return { latest, intraday };
};

export const pipelineCollections = () => (collections ??= openCollections());

const isDuplicateKey = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;

// Only moves forward: the filter matches an older (or missing) document, so an
// out-of-order older quote finds no match, tries to insert, hits the unique index and
// is dropped.
export const upsertLatestQuote = async (quote: QuoteMessage) => {
  const { latest } = await pipelineCollections();
  const { market, exchange, ticker } = quote;
  try {
    await latest.updateOne(
      { market, exchange, ticker, asOf: { $lt: quote.asOf } },
      { $set: { ...quote, updatedAt: new Date() } },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
};

export const appendIntradayQuote = async (quote: QuoteMessage, archivedAt: Date) => {
  const { intraday } = await pipelineCollections();
  const { market, exchange, ticker, asOf, source } = quote;
  await intraday.updateOne(
    { market, exchange, ticker, asOf, source },
    { $setOnInsert: { ...quote, archivedAt } },
    { upsert: true },
  );
};
