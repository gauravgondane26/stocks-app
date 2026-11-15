"""MongoDB access for the batch jobs.

Reads watchlists from the app's `openwatch` database and writes only to
`openwatch_pipeline`, like the Kafka worker. MONGODB_URI comes from the environment.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Iterable

from pymongo import ASCENDING, MongoClient, UpdateOne
from pymongo.database import Database

APP_DB = "openwatch"
PIPELINE_DB = "openwatch_pipeline"

_client: MongoClient | None = None


def client() -> MongoClient:
    global _client
    if _client is None:
        uri = os.environ.get("MONGODB_URI")
        if not uri:
            raise RuntimeError(
                "MONGODB_URI is not set. Start Airflow with "
                "`docker compose --env-file .env.local -f pipeline/docker-compose.yml --profile airflow up -d`."
            )
        _client = MongoClient(uri, appname="openwatch-airflow")
    return _client


def app_db() -> Database:
    return client()[APP_DB]


def pipeline_db() -> Database:
    return client()[PIPELINE_DB]


def watchlist_rows(market: str) -> list[dict]:
    """Distinct (exchange, ticker) pairs on any watchlist for the market."""
    cursor = app_db()["watchlists"].aggregate(
        [
            {"$match": {"market": market}},
            {"$group": {"_id": {"exchange": "$exchange", "ticker": "$ticker"}}},
        ]
    )
    return [row["_id"] for row in cursor]


def ensure_indexes() -> None:
    db = pipeline_db()
    db["daily_bars"].create_index(
        [("market", ASCENDING), ("yahoo", ASCENDING), ("date", ASCENDING)], unique=True
    )
    db["quality_reports"].create_index([("market", ASCENDING), ("date", ASCENDING)], unique=True)


def upsert_daily_bars(market: str, day: str, rows: Iterable[dict]) -> int:
    """One document per stock per day; re-running a day (or a backfill) replaces it."""
    now = datetime.now(timezone.utc)
    operations = [
        UpdateOne(
            {"market": market, "yahoo": row["yahoo"], "date": day},
            {"$set": {**row, "market": market, "date": day, "loadedAt": now}},
            upsert=True,
        )
        for row in rows
    ]
    if not operations:
        return 0
    result = pipeline_db()["daily_bars"].bulk_write(operations, ordered=False)
    return result.upserted_count + result.modified_count


def save_quality_report(market: str, day: str, report: dict) -> None:
    pipeline_db()["quality_reports"].update_one(
        {"market": market, "date": day},
        {"$set": {**report, "market": market, "date": day, "checkedAt": datetime.now(timezone.utc)}},
        upsert=True,
    )


def save_stream_section(market: str, day: str, section: dict) -> None:
    """Adds the stream-vs-batch comparison to the day's quality report."""
    pipeline_db()["quality_reports"].update_one(
        {"market": market, "date": day},
        {"$set": {"stream": section}},
        upsert=True,
    )


def intraday_last_prices(market: str, day_start_ms: int, day_end_ms: int) -> list[dict]:
    """The last streamed quote per stock between two times, from the Kafka archiver."""
    cursor = pipeline_db()["intraday_quotes"].aggregate(
        [
            {"$match": {"market": market, "asOf": {"$gte": day_start_ms, "$lt": day_end_ms}}},
            {"$sort": {"asOf": 1}},
            {
                "$group": {
                    "_id": {"exchange": "$exchange", "ticker": "$ticker"},
                    "price": {"$last": "$price"},
                    "asOf": {"$last": "$asOf"},
                    "source": {"$last": "$source"},
                    "quotes": {"$sum": 1},
                }
            },
        ]
    )
    return [
        {
            "exchange": row["_id"]["exchange"],
            "ticker": row["_id"]["ticker"],
            "price": row["price"],
            "asOf": row["asOf"],
            "source": row["source"],
            "quotes": row["quotes"],
        }
        for row in cursor
    ]
