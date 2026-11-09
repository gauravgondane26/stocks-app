import { MARKETS } from "@/lib/market/markets";
import type { MarketId, StockSearchResult } from "@/lib/market/types";

const toResults = (
  market: MarketId,
  stocks: [ticker: string, name: string][],
): StockSearchResult[] =>
  stocks.map(([ticker, name]) => ({
    symbol: { market, exchange: MARKETS[market].unresolvedExchange, ticker },
    name,
  }));

// Shown when the search box is empty. Kept static so opening search costs no API calls.
export const POPULAR_STOCKS: Record<MarketId, StockSearchResult[]> = {
  US: toResults("US", [
    ["AAPL", "Apple"],
    ["MSFT", "Microsoft"],
    ["NVDA", "NVIDIA"],
    ["GOOGL", "Alphabet"],
    ["AMZN", "Amazon"],
    ["META", "Meta Platforms"],
    ["TSLA", "Tesla"],
    ["JPM", "JPMorgan Chase"],
    ["V", "Visa"],
    ["NFLX", "Netflix"],
  ]),
  IN: toResults("IN", [
    ["RELIANCE", "Reliance Industries"],
    ["TCS", "Tata Consultancy Services"],
    ["HDFCBANK", "HDFC Bank"],
    ["ICICIBANK", "ICICI Bank"],
    ["INFY", "Infosys"],
    ["SBIN", "State Bank of India"],
    ["BHARTIARTL", "Bharti Airtel"],
    ["ITC", "ITC"],
    ["HINDUNILVR", "Hindustan Unilever"],
    ["BAJFINANCE", "Bajaj Finance"],
  ]),
};
