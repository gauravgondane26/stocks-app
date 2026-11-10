import "server-only";

import {
  getScanModel,
  type ScanDocument,
  type ScanMode,
} from "@/database/models/scan.model";
import { getWatchlistModel } from "@/database/models/watchlist.model";
import { getMarketData } from "@/lib/market";
import indexMembers from "@/lib/market/data/index-members.json";
import { getMarketClock } from "@/lib/market/hours";
import { MARKETS } from "@/lib/market/markets";
import type { MarketId, StockSymbol } from "@/lib/market/types";
import {
  confirmOrbHit,
  findOrbCandidates,
  orbWindow,
  scanDaily,
  type OrbHit,
  type ScanSymbol,
} from "@/lib/trade/scanner";
import { toHHMM } from "@/lib/trade/session";

// The skill's cap on full-chart checks per breakout scan, most traded first.
const MAX_CONFIRM = 200;
const CONFIRM_BATCH_SIZE = 5;
const CONFIRM_PAUSE_MS = 500;

export const getIndexInfo = (market: MarketId) => {
  const { index, members } = indexMembers[market];
  return { index, members: members as ScanSymbol[] };
};

const toSymbol = (market: MarketId, { ticker }: ScanSymbol): StockSymbol => ({
  market,
  exchange: MARKETS[market].unresolvedExchange,
  ticker,
});

// The index plus extra stocks such as watchlists, without repeats.
export const buildUniverse = (market: MarketId, extra: ScanSymbol[]) => {
  const byTicker = new Map<string, ScanSymbol>();
  for (const symbol of [...getIndexInfo(market).members, ...extra]) {
    if (!byTicker.has(symbol.ticker)) byTicker.set(symbol.ticker, symbol);
  }
  return [...byTicker.values()];
};

// Every user's watchlist in a market, for the scheduled scans. The page only shows
// each person hits from the index and their own watchlist.
export const allWatchlistSymbols = async (market: MarketId): Promise<ScanSymbol[]> => {
  const Watchlist = await getWatchlistModel();
  const rows = await Watchlist.find({ market }).select({ ticker: 1, company: 1 }).lean();
  return rows.map(({ ticker, company }) => ({ ticker, name: company }));
};

export type ScanOutcome =
  | { ok: true; scan: Omit<ScanDocument, "userId" | "createdAt"> }
  | { ok: false; reason: string };

export const runScan = async (
  market: MarketId,
  mode: ScanMode,
  universe: ScanSymbol[],
  now: Date = new Date(),
): Promise<ScanOutcome> => {
  const data = getMarketData(market);
  const symbols = universe.map((symbol) => toSymbol(market, symbol));
  const universeInfo = { index: getIndexInfo(market).index, size: universe.length };

  if (mode === "daily") {
    const series = await data.closeSeries(symbols, { interval: "1d", range: "3mo" });
    if (!series.ok) return { ok: false, reason: "price data is unavailable right now" };
    const { hits, counts, closeDate } = scanDaily(series.data, universe, { market, now });
    return {
      ok: true,
      scan: { market, mode, dataDate: closeDate, cutoff: null, universe: universeInfo, counts, hits },
    };
  }

  const window = orbWindow(market, now, {
    noEntriesAfter: MARKETS[market].tradeDefaults.noEntriesAfter,
  });
  if (!window.ok) return { ok: false, reason: window.reason };

  const series = await data.closeSeries(symbols, { interval: "5m", range: "1d" });
  if (!series.ok) return { ok: false, reason: "price data is unavailable right now" };
  const { candidates, counts } = findOrbCandidates(series.data, universe, { market, window });

  const toConfirm = candidates.slice(0, MAX_CONFIRM);
  const hits: OrbHit[] = [];
  let failed = 0;
  for (let start = 0; start < toConfirm.length; start += CONFIRM_BATCH_SIZE) {
    if (start > 0) await new Promise((resolve) => setTimeout(resolve, CONFIRM_PAUSE_MS));
    const batch = toConfirm.slice(start, start + CONFIRM_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((symbol) =>
        data.bars(toSymbol(market, symbol), { interval: "5m", range: "1d" }),
      ),
    );
    results.forEach((result, index) => {
      const hit = result.ok ? confirmOrbHit(result.data, batch[index], { market, window }) : "unusable";
      if (hit === "unusable") failed += 1;
      else if (hit) hits.push(hit);
    });
  }
  hits.sort((a, b) => a.at.localeCompare(b.at) || a.ticker.localeCompare(b.ticker));

  return {
    ok: true,
    scan: {
      market,
      mode,
      dataDate: window.date,
      cutoff: toHHMM(window.cutoff),
      universe: universeInfo,
      counts: {
        ...counts,
        confirmed: toConfirm.length - failed,
        unconfirmed: candidates.length - toConfirm.length,
        failed,
        hits: hits.length,
      },
      hits,
    },
  };
};

export const saveScan = async (
  scan: Omit<ScanDocument, "userId" | "createdAt">,
  userId: string | null,
) => {
  const Scan = await getScanModel();
  await Scan.create({ ...scan, userId, createdAt: new Date() });
};

// The newest scan this person can see: a scheduled one or one of their own.
export const findLatestScan = async (
  market: MarketId,
  mode: ScanMode,
  userId: string,
): Promise<(ScanDocument & { createdAt: Date }) | null> => {
  const Scan = await getScanModel();
  return Scan.findOne({ market, mode, userId: { $in: [null, userId] } })
    .sort({ createdAt: -1 })
    .lean();
};

export const marketClockLabel = (market: MarketId, at: Date) => {
  const { date, time } = getMarketClock(market, at);
  return `${date} ${time}`;
};
