// `npm run evaluator`: consumer group alert-evaluator. Runs the app's alert rules on
// every quote and sends matches to alerts.ringing. Malformed quotes go to quotes.dlq
// with the error and their origin in the headers.
import { loadActiveAlerts } from "./db";
import { createAlertCache, handleQuote } from "./handlers";
import { createProducer, runConsumer } from "./kafka";
import { encodeMessage } from "./messages";
import {
  ALERTS_RINGING_TOPIC,
  CONSUMER_GROUPS,
  QUOTE_TOPICS,
  QUOTES_DLQ_TOPIC,
} from "./topics";

const ALERT_CACHE_MS = 30_000;

const producer = createProducer("openwatch-evaluator");
const alertsFor = createAlertCache(loadActiveAlerts, ALERT_CACHE_MS);
const alreadyRung = new Set<string>();

await runConsumer({
  clientId: "openwatch-evaluator",
  groupId: CONSUMER_GROUPS.evaluator,
  topics: Object.values(QUOTE_TOPICS),
  startAt: "latest",
  handle: async (message) => {
    const origin = {
      topic: message.topic,
      partition: message.partition,
      offset: message.offset.toString(),
    };
    const result = await handleQuote(message.value, origin, {
      alertsFor,
      alreadyRung,
      produceRing: async (ring) => {
        await producer.send({
          messages: [{ topic: ALERTS_RINGING_TOPIC, key: ring.alertId, value: encodeMessage(ring) }],
        });
      },
      sendToDlq: async (raw, error, from) => {
        await producer.send({
          messages: [
            {
              topic: QUOTES_DLQ_TOPIC,
              key: message.key || undefined,
              value: raw ?? "",
              headers: {
                error,
                "source-topic": from.topic,
                "source-partition": String(from.partition),
                "source-offset": from.offset,
              },
            },
          ],
        });
      },
    });

    if (result.kind === "dead-lettered") {
      console.warn(`${origin.topic}#${origin.offset} -> ${QUOTES_DLQ_TOPIC}: ${result.error}`);
    } else if (result.rang.length > 0) {
      console.log(`${message.key}: ${result.rang.length} alert(s) -> ${ALERTS_RINGING_TOPIC}`);
    }
  },
});
