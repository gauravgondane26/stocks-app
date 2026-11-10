import "server-only";

import { cron } from "inngest";

import { findRingingAlerts, ringAlert } from "@/lib/alerts/check";
import { inngest } from "@/lib/inngest/client";

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
