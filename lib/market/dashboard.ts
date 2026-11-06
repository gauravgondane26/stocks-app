import {
  HEATMAP_WIDGET_CONFIG,
  MARKET_DATA_WIDGET_CONFIG,
  MARKET_OVERVIEW_WIDGET_CONFIG,
  TOP_STORIES_WIDGET_CONFIG,
} from "@/lib/constants";
import type { MarketId } from "@/lib/market/types";

type DashboardSymbol = { symbol: string; name: string };
type DashboardGroup = { title: string; symbols: DashboardSymbol[] };

// BSE symbols because TradingView embeds refuse NSE ones. Nifty indices have no
// embeddable symbol, so the index group uses BSE indices only.
const INDIA_GROUPS: DashboardGroup[] = [
  {
    title: "Indices",
    symbols: [
      { symbol: "BSE:SENSEX", name: "BSE Sensex" },
      { symbol: "BSE:BSE100", name: "BSE 100" },
      { symbol: "BSE:BSE500", name: "BSE 500" },
      { symbol: "BSE:BANK", name: "BSE Bank" },
      { symbol: "BSE:AUTO", name: "BSE Auto" },
    ],
  },
  {
    title: "Financial",
    symbols: [
      { symbol: "BSE:HDFCBANK", name: "HDFC Bank" },
      { symbol: "BSE:ICICIBANK", name: "ICICI Bank" },
      { symbol: "BSE:SBIN", name: "State Bank of India" },
      { symbol: "BSE:KOTAKBANK", name: "Kotak Mahindra Bank" },
      { symbol: "BSE:AXISBANK", name: "Axis Bank" },
      { symbol: "BSE:BAJFINANCE", name: "Bajaj Finance" },
    ],
  },
  {
    title: "Technology",
    symbols: [
      { symbol: "BSE:TCS", name: "Tata Consultancy Services" },
      { symbol: "BSE:INFY", name: "Infosys" },
      { symbol: "BSE:HCLTECH", name: "HCL Technologies" },
      { symbol: "BSE:WIPRO", name: "Wipro" },
      { symbol: "BSE:TECHM", name: "Tech Mahindra" },
      { symbol: "BSE:LTM", name: "LTIMindtree" },
    ],
  },
  {
    title: "Consumer & Energy",
    symbols: [
      { symbol: "BSE:RELIANCE", name: "Reliance Industries" },
      { symbol: "BSE:HINDUNILVR", name: "Hindustan Unilever" },
      { symbol: "BSE:ITC", name: "ITC" },
      { symbol: "BSE:BHARTIARTL", name: "Bharti Airtel" },
      { symbol: "BSE:ASIANPAINT", name: "Asian Paints" },
      { symbol: "BSE:MARUTI", name: "Maruti Suzuki" },
    ],
  },
];

type DashboardConfig = Record<
  "overview" | "heatmap" | "topStories" | "quotes",
  Record<string, unknown>
>;

const INDIA_DASHBOARD: DashboardConfig = {
  overview: {
    ...MARKET_OVERVIEW_WIDGET_CONFIG,
    tabs: INDIA_GROUPS.map(({ title, symbols }) => ({
      title,
      symbols: symbols.map(({ symbol, name }) => ({ s: symbol, d: name })),
    })),
  },
  heatmap: {
    ...HEATMAP_WIDGET_CONFIG,
    dataSource: "SENSEX",
  },
  // TradingView has no Indian news feed for embeds, so this is the global feed.
  // Phase 6 chooses an Indian news source.
  topStories: {
    displayMode: TOP_STORIES_WIDGET_CONFIG.displayMode,
    colorTheme: TOP_STORIES_WIDGET_CONFIG.colorTheme,
    isTransparent: TOP_STORIES_WIDGET_CONFIG.isTransparent,
    locale: TOP_STORIES_WIDGET_CONFIG.locale,
    width: TOP_STORIES_WIDGET_CONFIG.width,
    height: TOP_STORIES_WIDGET_CONFIG.height,
    feedMode: "all_symbols",
  },
  quotes: {
    ...MARKET_DATA_WIDGET_CONFIG,
    symbolsGroups: INDIA_GROUPS.map(({ title, symbols }) => ({
      name: title,
      symbols: symbols.map(({ symbol, name }) => ({
        name: symbol,
        displayName: name,
      })),
    })),
  },
};

const DASHBOARDS: Record<MarketId, DashboardConfig> = {
  US: {
    overview: MARKET_OVERVIEW_WIDGET_CONFIG,
    heatmap: HEATMAP_WIDGET_CONFIG,
    topStories: TOP_STORIES_WIDGET_CONFIG,
    quotes: MARKET_DATA_WIDGET_CONFIG,
  },
  IN: INDIA_DASHBOARD,
};

export const getDashboardConfig = (market: MarketId) => DASHBOARDS[market];
