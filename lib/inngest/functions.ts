import "server-only";

import { cron } from "inngest";

import type { ScanMode } from "@/database/models/scan.model";
import { findRingingAlerts, ringAlert } from "@/lib/alerts/check";
import { inngest } from "@/lib/inngest/client";
import { isTradingDay } from "@/lib/market/hours";
import { MARKET_IDS, MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import { allWatchlistSymbols, buildUniverse, runScan, saveScan } from "@/lib/scanner";
import { toMinutes } from "@/lib/trade/session";
import { deliverWelcomeEmail, findWelcomeProfile, writeWelcomeIntro } from "@/lib/welcome";

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
    const profile = await step.run("load-profile", () => findWelcomeProfile(userId));
    if (!profile) return { skipped: "user not found" };

    const intro = await step.run("write-intro", () => writeWelcomeIntro(profile));
    const sent = await step.run("send-email", () => deliverWelcomeEmail(userId, intro.text));
    return { introSource: intro.source, sent };
  },
);

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

    return { checked: candidates.length, rang };
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
          if (!isTradingDay(market, now)) return { skipped: "market closed today" };

          const universe = buildUniverse(market, await allWatchlistSymbols(market));
          const outcome = await runScan(market, mode, universe, now);
          if (!outcome.ok) return { skipped: outcome.reason };
          await saveScan(outcome.scan, null);
          return outcome.scan.counts;
        }),
    ),
  ),
);
