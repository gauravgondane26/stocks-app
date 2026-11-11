import "server-only";

import { getWatchlistModel } from "@/database/models/watchlist.model";
import { generateText } from "@/lib/ai";
import { claimsLivePrices, cleanAiText, givesAdvice } from "@/lib/ai/checks";
import { getMarketData } from "@/lib/market";
import { getMarketClock, isTradingDay } from "@/lib/market/hours";
import { describeMarket, MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import { sendDigestEmail } from "@/lib/nodemailer";
import type { DigestStock } from "@/lib/nodemailer/templates";
import { findUserFields } from "@/lib/users";

// The daily news digest: one email per user per market on trading days, listing
// new headlines for the stocks on their watchlist. Run by the Inngest functions in
// lib/inngest/functions.ts, one step per stage.

const MAX_STOCKS = 25;
const HEADLINES_PER_STOCK = 3;
// Between news requests, to stay polite to the free feeds.
const NEWS_PAUSE_MS = 300;
const MAX_SUMMARY_LENGTH = 900;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DigestEntry = { exchange: string; ticker: string; company: string };
export type DigestNews = { stocks: DigestStock[]; quiet: string[] };
export type DigestSummary = { text: string | null; model: string | null };

// News since the previous trading day's digest: a day back on most days, three
// after a weekend, more after a holiday.
export const digestWindow = (market: MarketId, now: Date = new Date()) => {
  let days = 1;
  while (days < 10 && !isTradingDay(market, new Date(now.getTime() - days * DAY_MS))) days += 1;
  return { date: getMarketClock(market, now).date, since: now.getTime() - days * DAY_MS };
};

export const findDigestUserIds = async (market: MarketId): Promise<string[]> => {
  const Watchlist = await getWatchlistModel();
  return (await Watchlist.distinct("userId", { market })).map(String);
};

export const loadDigestWatchlist = async (userId: string, market: MarketId): Promise<DigestEntry[]> => {
  const Watchlist = await getWatchlistModel();
  const rows = await Watchlist.find({ userId, market })
    .sort({ addedAt: 1 })
    .limit(MAX_STOCKS)
    .select({ exchange: 1, ticker: 1, company: 1 })
    .lean();
  return rows.map(({ exchange, ticker, company }) => ({ exchange, ticker, company }));
};

// A stock whose news couldn't be fetched counts as quiet: one failed feed
// shouldn't hold back the rest of the email.
export const collectDigestNews = async (
  market: MarketId,
  entries: DigestEntry[],
  since: number,
): Promise<DigestNews> => {
  const data = getMarketData(market);
  const stocks: DigestStock[] = [];
  const quiet: string[] = [];
  for (const [index, entry] of entries.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, NEWS_PAUSE_MS));
    const result = await data.news(
      { market, exchange: entry.exchange, ticker: entry.ticker },
      entry.company,
    );
    const items = result.ok
      ? result.data
          .filter((item) => item.publishedAt >= since)
          .slice(0, HEADLINES_PER_STOCK)
          .map(({ headline, url, source, publishedAt }) => ({ headline, url, source, publishedAt }))
      : [];
    if (items.length > 0) stocks.push({ ticker: entry.ticker, company: entry.company, items });
    else quiet.push(entry.ticker);
  }
  return { stocks, quiet };
};

const SUMMARY_INSTRUCTIONS = `You write the opening paragraph of a daily email that lists news headlines about the stocks on the reader's watchlist in OpenWatch, a read-only stock market dashboard. Using only the headlines given, write 2 to 4 short sentences in plain text that say which companies were in the news and what the stories were about. Report what the headlines say and add no facts, numbers or reasons of your own. Do not predict prices, do not say whether to buy, sell or hold, and do not give financial advice, even when a headline does. OpenWatch prices are delayed, so if you mention prices, call them delayed. The email already greets the reader, so start straight away without "Welcome" or "Hi". No sign-off, no markdown, no links.`;

export const digestPrompt = (market: MarketId, stocks: DigestStock[]) =>
  [
    `Market: ${describeMarket(market)}`,
    "",
    ...stocks.flatMap(({ ticker, company, items }) => [
      `${ticker} (${company})`,
      ...items.map((item) => `- ${item.headline} (${item.source})`),
      "",
    ]),
  ]
    .join("\n")
    .trim();

export const isUsableSummary = (text: string) => {
  const cleaned = cleanAiText(text);
  return (
    cleaned.length > 0 &&
    cleaned.length <= MAX_SUMMARY_LENGTH &&
    !claimsLivePrices(cleaned) &&
    !givesAdvice(cleaned)
  );
};

// Null text when every model failed or broke the rules: the email then goes out
// with the headlines alone.
export const writeDigestSummary = async (
  market: MarketId,
  stocks: DigestStock[],
): Promise<DigestSummary> => {
  const result = await generateText({
    instructions: SUMMARY_INSTRUCTIONS,
    input: digestPrompt(market, stocks),
    accept: isUsableSummary,
  });
  if (result.ok) return { text: cleanAiText(result.text), model: result.model };

  console.warn("Digest summary left out:", result.reason);
  return { text: null, model: null };
};

const dateLabel = (market: MarketId, date: string) =>
  new Intl.DateTimeFormat(MARKETS[market].locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.parse(`${date}T12:00:00Z`));

// Loads the contact details here, inside the send step, so they never end up in
// the job's saved step results.
export const deliverDigestEmail = async ({
  userId,
  market,
  date,
  news,
  summary,
}: {
  userId: string;
  market: MarketId;
  date: string;
  news: DigestNews;
  summary: string | null;
}): Promise<boolean> => {
  const user = await findUserFields(userId, { email: 1, name: 1 });
  if (!user?.email) return false;
  const { label, locale, timeZone } = MARKETS[market];
  return sendDigestEmail(String(user.email), {
    name: String(user.name ?? "there"),
    marketLabel: label,
    dateLabel: dateLabel(market, date),
    summary,
    stocks: news.stocks,
    quiet: news.quiet,
    watchlistUrl: `${process.env.BETTER_AUTH_URL}/watchlist`,
    locale,
    timeZone,
  });
};
