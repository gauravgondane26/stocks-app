// Pure helpers for the quote producer: which stocks to poll, and turning a provider
// quote into a message. No database or network.
import type { AlertType } from "@/lib/alerts/types";
import { getMarketClock } from "@/lib/market/hours";
import type { MarketId, Quote, StockSymbol } from "@/lib/market/types";

import type { QuoteMessage, QuoteSource } from "./messages";

type Listing = { exchange: string; ticker: string };

// Time and opening-bell alerts need a clock, not a price, so they stay with Inngest
// and their stocks aren't polled for them.
export const needsQuote = (type: AlertType) => type !== "time" && type !== "opening_bell";

// One entry per stock, from active price alerts and watchlists, in a stable order so
// batches and logs are repeatable.
export const symbolsToPoll = (
  market: MarketId,
  alerts: (Listing & { type: AlertType })[],
  watchlist: Listing[],
): StockSymbol[] => {
  const byKey = new Map<string, StockSymbol>();
  const add = ({ exchange, ticker }: Listing) =>
    byKey.set(`${exchange}:${ticker}`, { market, exchange, ticker });

  alerts.filter(({ type }) => needsQuote(type)).forEach(add);
  watchlist.forEach(add);

  return [...byKey.values()].sort(
    (a, b) => a.ticker.localeCompare(b.ticker) || a.exchange.localeCompare(b.exchange),
  );
};

// Right after the open Yahoo can still report yesterday's price, so a quote counts
// only when it's dated today in the market's own time zone (as in lib/alerts/check.ts).
export const isFromToday = (market: MarketId, asOf: number, now: Date = new Date()) =>
  getMarketClock(market, new Date(asOf)).date === getMarketClock(market, now).date;

export const toQuoteMessage = (
  quote: Quote,
  polledAt: number,
  source: QuoteSource,
): QuoteMessage => ({
  market: quote.symbol.market,
  exchange: quote.symbol.exchange,
  ticker: quote.symbol.ticker,
  price: quote.price,
  previousClose: quote.previousClose,
  asOf: quote.asOf,
  polledAt,
  source,
});
