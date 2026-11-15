// Kafka client setup shared by every service. The broker list comes from KAFKA_BROKERS
// (comma-separated), defaulting to the docker-compose broker on localhost.
import {
  Admin,
  Consumer,
  Producer,
  ProduceAcks,
  stringDeserializers,
  stringSerializers,
} from "@platformatic/kafka";

import { TOPIC_SPECS } from "./topics";

const brokers = () =>
  (process.env.KAFKA_BROKERS ?? "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);

export const createAdmin = (clientId: string) =>
  new Admin({ clientId, bootstrapBrokers: brokers() });

// Idempotent with acks from all replicas: a retried send can't write a message twice.
export const createProducer = (clientId: string) =>
  new Producer({
    clientId,
    bootstrapBrokers: brokers(),
    serializers: stringSerializers,
    idempotent: true,
    acks: ProduceAcks.ALL,
  });

export const createConsumer = (clientId: string, groupId: string) =>
  new Consumer({
    clientId,
    groupId,
    bootstrapBrokers: brokers(),
    deserializers: stringDeserializers,
  });

// Creates whichever pipeline topics don't exist yet, so `docker compose down` followed
// by any service start rebuilds them. Returns the names it created.
export const ensureTopics = async (admin: Admin): Promise<string[]> => {
  const existing = new Set(await admin.listTopics());
  const missing = TOPIC_SPECS.filter(({ name }) => !existing.has(name));

  for (const spec of missing) {
    await admin.createTopics({
      topics: [spec.name],
      partitions: spec.partitions,
      replicas: 1,
      configs:
        spec.retentionMs === undefined
          ? []
          : [{ name: "retention.ms", value: String(spec.retentionMs) }],
    });
  }
  return missing.map(({ name }) => name);
};

// Runs `close` once on Ctrl+C or a stop signal, then exits.
export const onShutdown = (close: () => Promise<void>) => {
  let closing = false;
  const handler = (signal: NodeJS.Signals) => {
    if (closing) return;
    closing = true;
    console.log(`${signal} received, shutting down`);
    close()
      .catch((error) => console.error("Shutdown failed:", error))
      .finally(() => process.exit(0));
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
};
