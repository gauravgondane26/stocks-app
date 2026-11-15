// Kafka client setup shared by every service. The broker list comes from KAFKA_BROKERS
// (comma-separated), defaulting to the docker-compose broker on localhost.
import {
  Admin,
  Consumer,
  type Message,
  MessagesStreamFallbackModes,
  MessagesStreamModes,
  Producer,
  ProduceAcks,
  stringDeserializers,
  stringSerializers,
} from "@platformatic/kafka";

import { processThenCommit } from "./handlers";
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

export type ConsumedMessage = Message<string, string, string, string>;

// The loop every consumer service shares: join `groupId`, read `topics` one message at
// a time, and commit each offset only after `handle` resolves (processThenCommit).
// A group with no committed offset starts at `startAt`: "latest" for services where
// old messages are stale (evaluator, notifier), "earliest" for the archiver, which
// should keep everything still retained.
export const runConsumer = async ({
  clientId,
  groupId,
  topics,
  startAt,
  handle,
}: {
  clientId: string;
  groupId: string;
  topics: string[];
  startAt: "latest" | "earliest";
  handle: (message: ConsumedMessage) => Promise<unknown>;
}) => {
  const admin = createAdmin(`${clientId}-admin`);
  try {
    await ensureTopics(admin);
  } finally {
    await admin.close();
  }

  const consumer = createConsumer(clientId, groupId);
  const stream = await consumer.consume({
    topics,
    autocommit: false,
    mode: MessagesStreamModes.COMMITTED,
    fallbackMode: startAt === "earliest" ? MessagesStreamFallbackModes.EARLIEST : MessagesStreamFallbackModes.LATEST,
  });

  onShutdown(async () => {
    await stream.close();
    await consumer.close();
  });

  console.log(`${clientId}: group ${groupId} reading ${topics.join(", ")}`);
  for await (const message of stream) {
    await processThenCommit(message, handle);
  }
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
