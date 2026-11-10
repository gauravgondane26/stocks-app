import "server-only";

import type { TradePlanPanelProps } from "@/components/TradePlanPanel";
import { getTradeSettings } from "@/lib/actions/settings.actions";
import { getMarketData } from "@/lib/market";
import { getMarketClock, isTradingDay } from "@/lib/market/hours";
import type {
  MarketDataResult,
  Quote,
  StockSymbol,
} from "@/lib/market/types";
import { evaluateEntry } from "@/lib/trade/entry";

const FRESH_MS = 15 * 60_000;

// Everything the trade plan panel needs that has to come from the server. The clock
// is fixed here so the server and browser render the same thing.
export const loadTradePlan = async (
  symbol: StockSymbol,
  quote: MarketDataResult<Quote>,
): Promise<Omit<TradePlanPanelProps, "market" | "ticker">> => {
  const now = new Date();
  const [bars, { settings, saved }] = await Promise.all([
    getMarketData(symbol.market).bars(symbol, { interval: "5m", range: "1d" }),
    getTradeSettings(symbol.market),
  ]);

  const entry = evaluateEntry(bars.ok ? bars.data : [], {
    market: symbol.market,
    now,
    noEntriesBefore: settings.noEntriesBefore,
    noEntriesAfter: settings.noEntriesAfter,
  });

  // The original only trusts a price under 15 minutes old.
  const age = quote.ok ? now.getTime() - quote.data.asOf : Infinity;
  const latestPrice =
    quote.ok && age >= -60_000 && age <= FRESH_MS ? quote.data.price : null;

  return {
    entry,
    barsAvailable: bars.ok,
    settings,
    settingsSaved: saved,
    latestPrice,
    clock: {
      ...getMarketClock(symbol.market, now),
      isTradingDay: isTradingDay(symbol.market, now),
    },
  };
};
