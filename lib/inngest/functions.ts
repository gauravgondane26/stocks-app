import "server-only";

import { cron } from "inngest";

import type { ScanMode } from "@/database/models/scan.model";
import { findRingingAlerts, ringAlert } from "@/lib/alerts/check";
import {
  collectDigestNews,
  deliverDigestEmail,
  digestWindow,
  findDigestUserIds,
  loadDigestWatchlist,
  writeDigestSummary,
} from "@/lib/digest";
import { wantsEmail } from "@/lib/email-settings";
import { inngest } from "@/lib/inngest/client";
import { holidayDataEnd, isTradingDay } from "@/lib/market/hours";
import { isMarketId, MARKET_IDS, MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import { allWatchlistSymbols, buildUniverse, runScan, saveScan } from "@/lib/scanner";
import { toMinutes } from "@/lib/trade/session";
import { findUserFields } from "@/lib/users";
import { deliverWelcomeEmail, writeWelcomeIntro } from "@/lib/welcome";

// Sent once per new user by the sign-up action. The event carries only the user id.
// Step results are saved by Inngest, so the profile step returns no name or email,
// and the AI step never throws: it falls back to plain text instead of retrying.
export const welcomeEmail = inngest.createFunction(
  {
    id: "send-welcome-email",
    retries: 2,
    triggers: [{ event: "app/user.created" }],
  },
  async ({ event, step }) => {
    const userId = typeof event.data?.userId === "string" ? event.data.userId : "";
    const market: MarketId = isMarketId(event.data?.market) ? event.data.market : "US";
    const exists = await step.run("find-user", async () => (await findUserFields(userId, { _id: 1 })) !== null);
    if (!exists) return { skipped: "user not found" };

    const intro = await step.run("write-intro", () => writeWelcomeIntro(market));
    const sent = await step.run("send-email", () => deliverWelcomeEmail(userId, intro.text, market));
    return { introSource: intro.source, model: intro.model, sent };
  },
);

// Past a holiday calendar's last date, isTradingDay can't see holidays, so a job may
// run on a closed day. The run's output and the logs say so until holidays.ts has the
// new year's dates.
const withCalendarWarnings = <T extends object>(markets: readonly MarketId[], result: T) => {
  const warnings = markets.flatMap((market) => {
    const end = holidayDataEnd(market);
    return end ? [`${market} holiday data ends ${end}: add the new dates to lib/market/holidays.ts`] : [];
  });
  if (warnings.length === 0) return result;
  for (const warning of warnings) console.warn(warning);
  return { ...result, warnings };
};

// Every 5 minutes is about 17,000 executions a month with one step per run. The free
// Inngest plan includes 50,000 (checked 2026-11-09). The event trigger is for testing
// by hand. Market hours are decided inside the step, from the market config.
export const checkAlerts = inngest.createFunction(
  {
    id: "check-alerts",
    retries: 1,
    concurrency: 1,
    triggers: [cron("*/5 * * * *"), { event: "app/alerts.check" }],
  },
  async ({ step }) => {
    const candidates = await step.run("find-ringing-alerts", () =>
      findRingingAlerts(),
    );

    let rang = 0;
    for (const candidate of candidates) {
      const didRing = await step.run(`ring-${candidate.alertId}`, () =>
        ringAlert(candidate),
      );
      if (didRing) rang += 1;
    }

    return withCalendarWarnings(MARKET_IDS, { checked: candidates.length, rang });
  },
);

// Weekdays at a market-time minute. The TZ prefix makes Inngest follow the market's
// clock, daylight saving included. Holidays are skipped inside the function.
const weekdayCron = (market: MarketId, minutes: number) =>
  `TZ=${MARKETS[market].timeZone} ${minutes % 60} ${Math.floor(minutes / 60)} * * 1-5`;

// The opening-range scan runs 45 minutes after the open (10:15 in New York, the skill's
// classic time), the daily scan 30 minutes after the close, once the day's bar is final.
const SCAN_TIMES: Record<ScanMode, (market: MarketId) => number> = {
  orb: (market) => toMinutes(MARKETS[market].open) + 45,
  daily: (market) => toMinutes(MARKETS[market].close) + 30,
};

// Weekdays at the market's digest time; holidays are skipped inside. It sends one
// event per user, so a failed email doesn't stop the rest, and the event id
// includes the date, so a repeat run on the same day can't email anyone twice.
export const digestSchedulers = MARKET_IDS.map((market) =>
  inngest.createFunction(
    {
      id: `digest-${market.toLowerCase()}`,
      retries: 1,
      concurrency: 1,
      triggers: [
        cron(weekdayCron(market, toMinutes(MARKETS[market].digestTime))),
        { event: `app/digest.${market.toLowerCase()}` },
      ],
    },
    async ({ step }) => {
      const plan = await step.run("plan", async () => {
        const now = new Date();
        if (!isTradingDay(market, now)) return null;
        const { date, since } = digestWindow(market, now);
        return { date, since, userIds: await findDigestUserIds(market) };
      });
      if (!plan) return withCalendarWarnings([market], { skipped: "market closed today" });
      if (plan.userIds.length > 0) {
        await step.sendEvent(
          "fan-out",
          plan.userIds.map((userId) => ({
            id: `digest-${market}-${plan.date}-${userId}`,
            name: "app/digest.user",
            data: { userId, market, date: plan.date, since: plan.since },
          })),
        );
      }
      return withCalendarWarnings([market], { date: plan.date, users: plan.userIds.length });
    },
  ),
);

// One user's digest. The event carries only ids, dates and the market, and the
// contact details are loaded inside the send step, so no name or email is saved
// in step results. Two at a time keeps the news feeds and OpenAI calls gentle.
export const digestForUser = inngest.createFunction(
  {
    id: "send-digest",
    retries: 2,
    concurrency: 2,
    triggers: [{ event: "app/digest.user" }],
  },
  async ({ event, step }) => {
    const { userId, market, date, since } = (event.data ?? {}) as Record<string, unknown>;
    if (
      typeof userId !== "string" ||
      !isMarketId(market) ||
      typeof date !== "string" ||
      typeof since !== "number"
    ) {
      return { skipped: "bad event data" };
    }

    // The scheduler already leaves these users out; this covers an event sent by
    // hand or a setting changed after the fan-out.
    const wanted = await step.run("check-settings", () => wantsEmail(userId, "digest"));
    if (!wanted) return { skipped: "digest turned off" };

    const entries = await step.run("load-watchlist", () => loadDigestWatchlist(userId, market));
    if (entries.length === 0) return { skipped: "empty watchlist" };

    const news = await step.run("collect-news", () => collectDigestNews(market, entries, since));
    // Nothing new for any stock: no email rather than an empty one.
    if (news.stocks.length === 0) return { skipped: "no new headlines", quiet: news.quiet.length };

    const summary = await step.run("write-summary", () => writeDigestSummary(market, news.stocks));
    const sent = await step.run("send-email", () =>
      deliverDigestEmail({ userId, market, date, news, summary: summary.text }),
    );
    return {
      stocks: news.stocks.length,
      quiet: news.quiet.length,
      summaryModel: summary.model,
      sent,
    };
  },
);

export const scanFunctions = MARKET_IDS.flatMap((market) =>
  (["daily", "orb"] as const).map((mode) =>
    inngest.createFunction(
      {
        id: `scan-${mode}-${market.toLowerCase()}`,
        retries: 1,
        concurrency: 1,
        triggers: [
          cron(weekdayCron(market, SCAN_TIMES[mode](market))),
          { event: `app/scan.${mode}.${market.toLowerCase()}` },
        ],
      },
      async ({ step }) =>
        step.run("scan", async () => {
          const now = new Date();
          if (!isTradingDay(market, now)) {
            return withCalendarWarnings([market], { skipped: "market closed today" });
          }

          const universe = buildUniverse(market, await allWatchlistSymbols(market));
          const outcome = await runScan(market, mode, universe, now);
          if (!outcome.ok) return withCalendarWarnings([market], { skipped: outcome.reason });
          await saveScan(outcome.scan, null);
          return withCalendarWarnings([market], outcome.scan.counts);
        }),
    ),
  ),
);
