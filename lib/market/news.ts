// Shared clean-up for company news from any provider. Pure: no network or database.
// Free feeds mix in quote pages, social posts and stories about other companies
// (about half of Finnhub's US items, checked 2026-11-11), so items are kept only
// when the headline names the company.

import type { NewsItem, StockSymbol } from "@/lib/market/types";

export const NEWS_DAYS = 7;
export const MAX_NEWS_ITEMS = 20;

const LEGAL_SUFFIX =
  /[\s,]+(?:limited|ltd\.?|inc\.?|incorporated|corp\.?|corporation|co\.?|company|plc|holdings?|group|n\.?v\.?|s\.?a\.?|ag|&)$/i;

// "Mahindra & Mahindra Limited" -> "Mahindra & Mahindra", "JPMORGAN CHASE & CO" -> "JPMORGAN CHASE".
export const shortCompanyName = (name: string) => {
  let short = name.trim().replace(/^the\s+/i, "");
  for (let previous = ""; previous !== short; ) {
    previous = short;
    short = short.replace(LEGAL_SUFFIX, "").trim();
  }
  return short || name.trim();
};

// First words too common to stand for one company. Indian group names (Tata,
// Bajaj, HDFC, Adani...) cover many listed companies, so India never uses the
// first word on its own.
const GENERIC_FIRST_WORDS = new Set([
  "general", "american", "united", "first", "bank", "international", "national",
  "global", "new", "public", "western", "eastern", "southern", "northern", "royal",
]);

// The ways a headline can name the company: its short name, its ticker, and for
// US companies a distinctive first word ("JPMorgan" for "JPMorgan Chase").
export const companyAliases = (symbol: StockSymbol, company: string | null) => {
  const aliases = new Set<string>();
  if (company) {
    const short = shortCompanyName(company);
    // A name that is the ticker ("ITC Limited") is left to the case-sensitive
    // ticker match, so "input tax credit (itc)" doesn't count as news about ITC.
    if (short.toLowerCase() !== symbol.ticker.toLowerCase()) aliases.add(short.toLowerCase());
    const first = short.split(/\s+/)[0];
    if (
      symbol.market === "US" &&
      first.length >= 5 &&
      !GENERIC_FIRST_WORDS.has(first.toLowerCase())
    ) {
      aliases.add(first.toLowerCase());
    }
  }
  return { names: [...aliases], ticker: symbol.ticker };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wholeWord = (word: string, flags = "") =>
  new RegExp(`(^|[^A-Za-z0-9&])${escapeRegExp(word)}([^A-Za-z0-9&]|$)`, flags);

// Names match as whole words in any case ("Apple", not "pineapple"). Tickers match
// case-sensitively, so "KO" doesn't match "ko".
const mentions = (headline: string, { names, ticker }: ReturnType<typeof companyAliases>) =>
  names.some((name) => wholeWord(name, "i").test(headline)) || wholeWord(ticker).test(headline);

// Price-quote, profile and price-prediction pages that search feeds return as if
// they were news.
const QUOTE_PAGE =
  /(?:share|stock) price$|(?:share|stock) price today|(?:share|stock) price,\s*(?:share|stock) price|price,? news,? quote|quote and history|live (?:nse|bse)\b|nse\/bse live|price (?:&|and) chart|price prediction|outlook for the week|key financial ratios/i;
const SOCIAL_SOURCES = /^(?:linkedin|facebook|instagram|youtube|x|twitter|reddit|threads)$/i;

export const filterNews = (
  items: NewsItem[],
  aliases: ReturnType<typeof companyAliases>,
  now: number = Date.now(),
): NewsItem[] => {
  const oldest = now - NEWS_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  return items
    .filter(
      (item) =>
        item.headline &&
        item.url &&
        item.publishedAt >= oldest &&
        item.publishedAt <= now + 60 * 60 * 1000 &&
        !QUOTE_PAGE.test(item.headline) &&
        !SOCIAL_SOURCES.test(item.source.trim()) &&
        mentions(item.headline, aliases),
    )
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .filter((item) => {
      const key = item.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_NEWS_ITEMS);
};
