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
  },
};

export const MARKET_IDS = Object.keys(MARKETS) as MarketId[];

export const MARKET_COOKIE = "openwatch-market";

export const isMarketId = (value: unknown): value is MarketId =>
  typeof value === "string" && MARKET_IDS.includes(value as MarketId);

// Everyone outside India starts on the US market, until they switch.
export const marketForCountry = (country: string | undefined): MarketId =>
  country === "IN" ? "IN" : "US";
