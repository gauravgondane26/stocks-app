// `npm run notifier`: consumer group alert-notifier. A dry run by default: it logs
// "would ring" for each message on alerts.ringing. With PIPELINE_RING_ALERTS=true it
// rings live alerts through the app's ringAlert (replayed ones always stay a dry run).
import { ringAlert } from "@/lib/alerts/check";

import { handleRinging } from "./handlers";
import { runConsumer } from "./kafka";
import { ALERTS_RINGING_TOPIC, CONSUMER_GROUPS } from "./topics";

const ringForReal = process.env.PIPELINE_RING_ALERTS === "true";
console.log(
  ringForReal
    ? "PIPELINE_RING_ALERTS=true: live alerts ring for real (in the app and by email)."
    : "Dry run: alerts are logged, not rung. Set PIPELINE_RING_ALERTS=true to ring them.",
);

await runConsumer({
  clientId: "openwatch-notifier",
  groupId: CONSUMER_GROUPS.notifier,
  topics: [ALERTS_RINGING_TOPIC],
  startAt: "latest",
  handle: (message) =>
    handleRinging(message.value, {
      ringForReal,
      ring: ringAlert,
      log: (line) => console.log(line),
    }),
});
