import { describe, expect, it } from "vitest";

import { companyAliases, filterNews, shortCompanyName } from "@/lib/market/news";
import { parseGoogleNewsRss } from "@/lib/market/providers/google-news";
import type { NewsItem, StockSymbol } from "@/lib/market/types";

const us = (ticker: string): StockSymbol => ({ market: "US", exchange: "US", ticker });
const india = (ticker: string): StockSymbol => ({ market: "IN", exchange: "NSE", ticker });

const now = Date.parse("2026-11-11T06:00:00Z");
const item = (headline: string, extra: { source?: string; hoursAgo?: number } = {}): NewsItem => ({
  headline,
  summary: "",
  url: `https://example.com/${encodeURIComponent(headline)}`,
  source: extra.source ?? "Economic Times",
  imageUrl: null,
  publishedAt: now - (extra.hoursAgo ?? 1) * 3_600_000,
});
const headlines = (items: NewsItem[]) => items.map(({ headline }) => headline);

describe("shortCompanyName", () => {
  it.each([
    ["Reliance Industries Limited", "Reliance Industries"],
    ["JPMORGAN CHASE & CO", "JPMORGAN CHASE"],
    ["APPLE INC", "APPLE"],
    ["NVIDIA CORP", "NVIDIA"],
    ["Mahindra & Mahindra Limited", "Mahindra & Mahindra"],
    ["The Coca-Cola Company", "Coca-Cola"],
  ])("%s -> %s", (name, short) => {
    expect(shortCompanyName(name)).toBe(short);
  });
});

describe("companyAliases", () => {
  it("adds a distinctive first word for US names", () => {
    expect(companyAliases(us("JPM"), "JPMORGAN CHASE & CO").names).toEqual(["jpmorgan chase", "jpmorgan"]);
  });

  it("skips a generic first word", () => {
    expect(companyAliases(us("GM"), "General Motors Co").names).toEqual(["general motors"]);
  });

  it("uses only the full short name for Indian companies", () => {
    expect(companyAliases(india("TCS"), "Tata Consultancy Services Limited").names).toEqual(["tata consultancy services"]);
  });

  it("drops a name equal to the ticker, leaving the case-sensitive ticker match", () => {
    expect(companyAliases(india("ITC"), "ITC Limited").names).toEqual([]);
  });
});

describe("filterNews", () => {
  it("keeps real news and drops quote pages, social posts, old items, other topics and duplicates", () => {
    const kept = filterNews(
      [
        item("ITC shares rise 3% after Q2 results", { hoursAgo: 2 }),
        item("ITC Share Price"),
        item("ITC Share Price Today (NSE), Market News"),
        item("ITC posts strong quarter", { source: "LinkedIn" }),
        item("ITC hotel demerger update", { hoursAgo: 24 * 8 }),
        item("Nifty ends flat as FMCG drags"),
        item("ITC shares rise 3% after Q2 results!", { hoursAgo: 3 }),
        item("Gst: input tax credit itc rules change"),
        item("ITC share price falls 2% on cigarette tax worries", { hoursAgo: 1 }),
      ],
      companyAliases(india("ITC"), "ITC Limited"),
      now,
    );
    expect(headlines(kept)).toEqual([
      "ITC share price falls 2% on cigarette tax worries",
      "ITC shares rise 3% after Q2 results",
    ]);
  });

  it("matches the ticker case-sensitively", () => {
    const kept = filterNews([item("ko fans cheer"), item("KO beats estimates")], companyAliases(us("KO"), null), now);
    expect(headlines(kept)).toEqual(["KO beats estimates"]);
  });

  it("matches names as whole words only", () => {
    const kept = filterNews(
      [item("Pineapple prices soar"), item("Apple unveils new iPhone")],
      companyAliases(us("AAPL"), "APPLE INC"),
      now,
    );
    expect(headlines(kept)).toEqual(["Apple unveils new iPhone"]);
  });

  it("drops a live quote page headline", () => {
    const kept = filterNews(
      [item("Reliance Industries Ltd. Share Price, Stock Price - NSE/BSE Live")],
      companyAliases(india("RELIANCE"), "Reliance Industries Limited"),
      now,
    );
    expect(kept).toHaveLength(0);
  });
});

describe("parseGoogleNewsRss", () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item>
      <title>HDFC Bank shares hit a three-month high &amp; more - Mint</title>
      <link>https://news.google.com/rss/articles/abc</link>
      <pubDate>Wed, 11 Nov 2026 04:30:00 GMT</pubDate>
      <source url="https://www.livemint.com">Mint</source>
    </item>
    <item>
      <title><![CDATA[M&M Q2: profit up 20%]]></title>
      <link>https://news.google.com/rss/articles/def</link>
      <pubDate>not a date</pubDate>
    </item>
  </channel></rss>`;

  it("strips the source suffix, decodes entities and reads CDATA", () => {
    const [first, second] = parseGoogleNewsRss(xml);
    expect(first).toMatchObject({
      headline: "HDFC Bank shares hit a three-month high & more",
      source: "Mint",
      url: "https://news.google.com/rss/articles/abc",
      publishedAt: Date.parse("2026-11-11T04:30:00Z"),
    });
    expect(second).toMatchObject({ headline: "M&M Q2: profit up 20%", source: "Google News", publishedAt: 0 });
  });
});
