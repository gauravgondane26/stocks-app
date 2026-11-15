"""Publishes `eod.ready` to the pipeline.events Kafka topic when a day is loaded."""

from __future__ import annotations

import json
import os

PIPELINE_EVENTS_TOPIC = "pipeline.events"


def eod_ready_event(market: str, day: str, summary: dict) -> dict:
    return {"type": "eod.ready", "market": market, "date": day, **summary}


def publish_eod_ready(market: str, day: str, summary: dict) -> dict:
    """Sends the event and waits for the broker to confirm it. Returns the event."""
    # Imported here so the pure modules and tests don't need confluent-kafka.
    from confluent_kafka import Producer

    event = eod_ready_event(market, day, summary)
    producer = Producer(
        {
            "bootstrap.servers": os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092"),
            "client.id": "openwatch-airflow",
            "enable.idempotence": True,
            "acks": "all",
        }
    )
    errors: list[str] = []
    producer.produce(
        PIPELINE_EVENTS_TOPIC,
        key=f"{market}:{day}",
        value=json.dumps(event),
        on_delivery=lambda error, _message: errors.append(str(error)) if error else None,
    )
    remaining = producer.flush(15)
    if remaining or errors:
        raise RuntimeError(f"eod.ready not delivered: {errors or 'timed out'}")
    return event
