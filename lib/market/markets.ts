import type { MarketId } from "@/lib/market/types";

export type ExchangeConfig = {
  code: string;
  tradingViewPrefix: string;
  yahooSuffix: string;
};

export type MarketConfig = {
  id: MarketId;
  label: string;
  timeZone: string;
  open: string;
  close: string;
  currency: string;
  locale: string;
  defaultExchange: string;
  // The exchange to assume before a profile lookup says which one a ticker is on.
  // US search can't tell NASDAQ from NYSE, so "US" stays unresolved on purpose.
  unresolvedExchange: string;
  exchanges: readonly ExchangeConfig[];
  // Defaults for the trade tools, in market time. Users can change them in Settings.
  tradeDefaults: {
    noEntriesBefore: string;
    noEntriesAfter: string;
    flatBy: string;
  };
  // When the daily news digest goes out on trading days, in market time.
  digestTime: string;
};

export const MARKETS: Record<MarketId, MarketConfig> = {
  US: {
    id: "US",
    label: "US",
    timeZone: "America/New_York",
    open: "09:30",
    close: "16:00",
    currency: "USD",
    locale: "en-US",
    defaultExchange: "NASDAQ",
    unresolvedExchange: "US",
    exchanges: [
      { code: "NASDAQ", tradingViewPrefix: "NASDAQ", yahooSuffix: "" },
      { code: "NYSE", tradingViewPrefix: "NYSE", yahooSuffix: "" },
      { code: "AMEX", tradingViewPrefix: "AMEX", yahooSuffix: "" },
    ],
    // The day-trader skill's defaults.
    tradeDefaults: {
      noEntriesBefore: "09:45",
      noEntriesAfter: "15:30",
      flatBy: "15:55",
    },
    // An hour after the daily scan.
    digestTime: "17:30",
  },
  IN: {
    id: "IN",
    label: "India",
    timeZone: "Asia/Kolkata",
    open: "09:15",
    close: "15:30",
    currency: "INR",
    locale: "en-IN",
    defaultExchange: "NSE",
    unresolvedExchange: "NSE",
    exchanges: [
      // TradingView embeds refuse NSE symbols ("only available on TradingView"), but
      // BSE works and big companies share a ticker, so widgets show the BSE listing.
      { code: "NSE", tradingViewPrefix: "BSE", yahooSuffix: ".NS" },
      { code: "BSE", tradingViewPrefix: "BSE", yahooSuffix: ".BO" },
    ],
    // The entry window keeps the US offsets: 15 minutes after the open to 30 minutes
    // before the close. The flat-by time was chosen by the owner on 2026-11-10.
    tradeDefaults: {
      noEntriesBefore: "09:30",
      noEntriesAfter: "15:00",
      flatBy: "15:15",
    },
    // The build plan's 5:30 PM IST, two hours after the close.
    digestTime: "17:30",
  },
};

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

// "India (NSE and BSE, prices in INR)", for AI prompts.
export const describeMarket = (market: MarketId) => {
  const { label, exchanges, currency } = MARKETS[market];
  return `${label} (${listFormat.format(exchanges.map(({ code }) => code))}, prices in ${currency})`;
};

export const MARKET_IDS = Object.keys(MARKETS) as MarketId[];

export const MARKET_COOKIE = "openwatch-market";

export const isMarketId = (value: unknown): value is MarketId =>
  typeof value === "string" && MARKET_IDS.includes(value as MarketId);

// Everyone outside India starts on the US market, until they switch.
export const marketForCountry = (country: string | undefined): MarketId =>
  country === "IN" ? "IN" : "US";
