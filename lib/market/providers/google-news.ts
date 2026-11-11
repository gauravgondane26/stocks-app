import "server-only";

import { fetchText } from "@/lib/market/http";
import { companyAliases, filterNews, NEWS_DAYS, shortCompanyName } from "@/lib/market/news";
import { findNseName } from "@/lib/market/providers/nse-search";
import type { MarketDataResult, NewsItem, StockSymbol } from "@/lib/market/types";

// Indian company news from Google News RSS search, by company name. Chosen
// 2026-11-11: Yahoo's per-ticker RSS (the day-trader skill's source) returned no
// items for RELIANCE, HDFCBANK or ITC and weeks-old ones for others, while this
// feed had same-day stories from Indian outlets for all seven stocks tried.
// Public, keyless and unofficial; links go through news.google.com redirects.
const SEARCH_URL = "https://news.google.com/rss/search";
const REVALIDATE_SECONDS = 900;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const decodeEntities = (text: string) =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });

const readTag = (xml: string, name: string) => {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  if (!match) return "";
  return decodeEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
};

// Titles arrive as "Headline - Source"; the source has its own tag.
export const parseGoogleNewsRss = (xml: string): NewsItem[] =>
  [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const source = readTag(item, "source");
    const title = readTag(item, "title");
    const suffix = ` - ${source}`;
    return {
      headline: source && title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title,
      // The feed's description is only a link back to the story, so there is no summary.
      summary: "",
      url: readTag(item, "link"),
      source: source || "Google News",
      imageUrl: null,
      publishedAt: Date.parse(readTag(item, "pubDate")) || 0,
    };
  });

export const googleNewsProvider = {
  async news(symbol: StockSymbol, company?: string): Promise<MarketDataResult<NewsItem[]>> {
    const name = company ?? findNseName(symbol.ticker);
    const searchName = name ? shortCompanyName(name) : symbol.ticker;
    // Market words keep the results on the stock: a plain "ITC" search was mostly
    // about input tax credit.
    const query = `"${searchName}" (shares OR stock OR NSE OR BSE) when:${NEWS_DAYS}d`;
    const result = await fetchText(
      `${SEARCH_URL}?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`,
      { revalidate: REVALIDATE_SECONDS, source: "Google News" },
    );
    if (!result.ok) return result;

    return {
      ok: true,
      data: filterNews(parseGoogleNewsRss(result.data), companyAliases(symbol, name)),
    };
  },
};
