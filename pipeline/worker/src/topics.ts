// Every topic and consumer group the pipeline uses, in one place. Pure: no Kafka client
// here, so tests and other modules can import it freely.
import type { MarketId } from "@/lib/market/types";

const HOUR_MS = 60 * 60 * 1000;

export type TopicSpec = {
  name: string;
  partitions: number;
  // Unset means the broker default (7 days).
  retentionMs?: number;
};

export const QUOTE_TOPICS: Record<MarketId, string> = {
  US: "quotes.us",
  IN: "quotes.in",
};

export const ALERTS_RINGING_TOPIC = "alerts.ringing";
export const QUOTES_DLQ_TOPIC = "quotes.dlq";
// Airflow publishes eod.ready here in Phase 8b.
export const PIPELINE_EVENTS_TOPIC = "pipeline.events";

export const TOPIC_SPECS: TopicSpec[] = [
  // Keyed by stock, so each stock's quotes stay in order on one partition.
  { name: QUOTE_TOPICS.US, partitions: 3, retentionMs: 24 * HOUR_MS },
  { name: QUOTE_TOPICS.IN, partitions: 3, retentionMs: 24 * HOUR_MS },
  // Keyed by alert id.
  { name: ALERTS_RINGING_TOPIC, partitions: 3 },
  { name: QUOTES_DLQ_TOPIC, partitions: 1 },
  { name: PIPELINE_EVENTS_TOPIC, partitions: 1 },
];

// Each group keeps its own offsets on the same topics, which is the point of using
// Kafka here: one Yahoo poll feeds every reader at its own pace.
export const CONSUMER_GROUPS = {
  evaluator: "alert-evaluator",
  notifier: "alert-notifier",
  archiver: "quote-archiver",
} as const;

export const quoteTopic = (market: MarketId) => QUOTE_TOPICS[market];
