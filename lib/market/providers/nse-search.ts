import "server-only";

import nseSymbols from "@/lib/market/data/nse-symbols.json";
import { MARKETS } from "@/lib/market/markets";
import type {
  MarketDataResult,
  StockSearchResult,
} from "@/lib/market/types";

const MAX_RESULTS = 10;

type NseSymbol = { ticker: string; name: string };

// Lower is better. Null means no match.
const rank = ({ ticker, name }: NseSymbol, query: string): number | null => {
  const lowerTicker = ticker.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerTicker === query) return 0;
  if (lowerTicker.startsWith(query)) return 1;
  if (lowerName.startsWith(query)) return 2;
  if (lowerName.includes(` ${query}`)) return 3;
  if (lowerTicker.includes(query) || lowerName.includes(query)) return 4;
  return null;
};

// The company name for an NSE ticker, or null when it isn't in the list.
export const findNseName = (ticker: string): string | null =>
  nseSymbols.symbols.find((symbol) => symbol.ticker === ticker)?.name ?? null;

// Searches the list seeded by scripts/seed-nse-symbols.mjs. BSE-only stocks aren't
// in it, though BSE tickers work for quotes and charts when the symbol is known.
export const searchNseSymbols = async (
  query: string,
): Promise<MarketDataResult<StockSearchResult[]>> => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return { ok: true, data: [] };

  const matches: { symbol: NseSymbol; score: number }[] = [];
  for (const symbol of nseSymbols.symbols) {
    const score = rank(symbol, trimmed);
    if (score !== null) matches.push({ symbol, score });
  }

  matches.sort(
    (a, b) =>
      a.score - b.score || a.symbol.ticker.localeCompare(b.symbol.ticker),
  );

  return {
    ok: true,
    data: matches.slice(0, MAX_RESULTS).map(({ symbol }) => ({
      symbol: {
        market: "IN",
        exchange: MARKETS.IN.defaultExchange,
        ticker: symbol.ticker,
      },
      name: symbol.name,
    })),
  };
};
