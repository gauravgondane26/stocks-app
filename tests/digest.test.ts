import { describe, expect, it } from "vitest";

import { digestWindow } from "@/lib/digest";
import type { MarketId } from "@/lib/market/types";
import { alertEmailHtml, alertEmailText, digestEmailHtml, digestEmailText, type DigestEmail } from "@/lib/nodemailer/templates";

const DAY_MS = 86_400_000;

// Digests run at 17:30 market time: 12:00 UTC in India, 22:30 UTC in New York (EST).
const window = (market: MarketId, iso: string) => {
  const now = new Date(iso);
  const { date, since } = digestWindow(market, now);
  return { date, days: Math.round((now.getTime() - since) / DAY_MS) };
};

describe("digestWindow", () => {
  it.each([
    ["IN", "2026-11-11T12:00:00Z", "Wednesday after the Diwali holiday covers 2 days", 2],
    ["IN", "2026-11-12T12:00:00Z", "Thursday covers 1 day", 1],
    ["US", "2026-11-11T22:30:00Z", "US Wednesday covers 1 day", 1],
    ["IN", "2026-11-16T12:00:00Z", "Monday reaches back to Friday", 3],
    ["US", "2026-11-27T22:30:00Z", "the Friday after Thanksgiving reaches back to Wednesday", 2],
  ] as const)("%s %s: %s", (market, iso, _, days) => {
    expect(window(market, iso)).toEqual({ date: iso.slice(0, 10), days });
  });
});

describe("digest email", () => {
  const email: DigestEmail = {
    name: "Test <b>",
    marketLabel: "India",
    dateLabel: "11 Nov 2026",
    summary: null,
    stocks: [
      {
        ticker: "XSS",
        company: "Bad & Co",
        items: [{ headline: "<script>alert(1)</script>", url: 'https://x.test/?a="b"', source: "Evil", publishedAt: Date.parse("2026-11-11T04:30:00Z") }],
      },
    ],
    quiet: ["TCS"],
    watchlistUrl: "http://localhost:3000/watchlist",
    settingsUrl: "http://localhost:3000/settings#email",
    locale: "en-IN",
    timeZone: "Asia/Kolkata",
  };
  const html = digestEmailHtml(email);
  const text = digestEmailText(email);

  it("escapes headlines, links and names in the HTML", () => {
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a=&quot;b&quot;");
    expect(html).toContain("Test &lt;b&gt;");
    expect(html).toContain("Bad &amp; Co");
  });

  it("still lists headlines and quiet stocks when there is no AI summary", () => {
    expect(text).toContain("<script>alert(1)</script>");
    expect(text).toContain("TCS");
  });

  it("ends with the opt-out link to Settings", () => {
    expect(html).toContain('href="http://localhost:3000/settings#email"');
    expect(text).toContain("turn them off in Settings: http://localhost:3000/settings#email");
  });
});

describe("alert email", () => {
  const alert = {
    company: "Apple Inc",
    message: "AAPL rose above $250.00",
    stockUrl: "http://localhost:3000/stocks/US/AAPL",
    settingsUrl: "http://localhost:3000/settings#email",
  };

  it("says prices are delayed, isn't advice, and links to Settings", () => {
    for (const body of [alertEmailHtml(alert), alertEmailText(alert)]) {
      expect(body).toContain("Prices are delayed");
      expect(body).toContain("not an order or financial advice");
      expect(body).toContain("settings#email");
    }
  });
});
