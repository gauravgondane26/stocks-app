"""End-of-day bars for OpenWatch: one DAG per market, built by one factory.

eod_bars_us runs at 16:30 New York time and eod_bars_in at 16:00 Kolkata time, Monday
to Friday. Each run covers its own trading day:

    build_universe -> fetch_bars -> check_trading_day -> quality_checks -> load
        -> publish_eod_ready

The schedules use CronTriggerTimetable in each market's time zone, which gives a
scheduled run a logical date equal to its trigger time, so the 16:30 run on 2026-11-13
is dated 2026-11-13: the session that just closed. A backfill (`airflow backfill create --dag-id eod_bars_us --from-date ...
--to-date ...`) creates one run per scheduled time in the range, each fetching its own
day. A manual run can name any day with the `date` param.

Holidays need no calendar: if almost no stock has a bar for the day, check_trading_day
skips the rest of the run.
"""

from __future__ import annotations

import json
import os
from datetime import date, timedelta
from pathlib import Path

import pendulum
from airflow.sdk import CronTriggerTimetable, Param, dag, get_current_context, task

from openwatch_pipeline.markets import get_market

REPO = Path(os.environ.get("OPENWATCH_REPO", "/opt/openwatch"))
INDEX_MEMBERS = REPO / "lib" / "market" / "data" / "index-members.json"
# Bars move between tasks through a file, not the XCom table: about 550 stocks a run.
WORK_DIR = Path(os.environ.get("OPENWATCH_WORK_DIR", "/tmp/openwatch-eod"))

DEFAULT_ARGS = {
    "owner": "openwatch",
    "retries": 2,
    "retry_delay": timedelta(minutes=2),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=15),
}


def run_day(market_id: str) -> date:
    """The trading day a run covers: the `date` param, else the logical date (or, for a
    manual run without one, its run_after time) in the market's own time zone."""
    context = get_current_context()
    chosen = context["params"].get("date")
    if chosen:
        return date.fromisoformat(chosen)
    moment = context.get("logical_date") or context["dag_run"].run_after
    return pendulum.instance(moment).in_timezone(get_market(market_id).time_zone).date()


def make_eod_dag(market_id: str, cron: str):
    market = get_market(market_id)

    @dag(
        dag_id=f"eod_bars_{market_id.lower()}",
        description=f"End-of-day bars for the {market.index_name} plus watchlists ({market_id})",
        # Explicit time zone: a bare cron string is read in UTC (the default time zone),
        # not the start_date's, which would run the US job at 11:30 New York time.
        schedule=CronTriggerTimetable(cron, timezone=market.time_zone),
        start_date=pendulum.datetime(2026, 11, 1, tz=market.time_zone),
        catchup=False,
        max_active_runs=1,
        default_args=DEFAULT_ARGS,
        params={
            "date": Param(
                None,
                type=["null", "string"],
                format="date",
                description="Trading day to load (YYYY-MM-DD). Empty means the run's own date.",
            )
        },
        tags=["openwatch", market_id],
    )
    def eod_bars():
        @task
        def build_universe() -> list[dict]:
            from openwatch_pipeline import store
            from openwatch_pipeline.universe import build_universe as combine

            members = json.loads(INDEX_MEMBERS.read_text(encoding="utf-8"))
            stocks = combine(market_id, members, store.watchlist_rows(market_id))
            print(f"{len(stocks)} {market_id} stocks: the {market.index_name} plus watchlists")
            return [{**stock.to_dict(), "yahoo": stock.yahoo} for stock in stocks]

        @task
        def fetch_bars(universe: list[dict]) -> str:
            from openwatch_pipeline.yahoo import fetch_daily_bars

            day = run_day(market_id)
            bars = fetch_daily_bars([s["yahoo"] for s in universe], day, market.time_zone)
            path = WORK_DIR / market_id / f"{day.isoformat()}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps({"date": day.isoformat(), "universe": universe, "bars": bars}),
                encoding="utf-8",
            )
            found = sum(1 for bar in bars.values() if bar)
            print(f"{day}: {found} of {len(universe)} stocks have a bar")
            return str(path)

        @task.short_circuit
        def check_trading_day(path: str) -> bool:
            from openwatch_pipeline.quality import was_trading_day

            data = json.loads(Path(path).read_text(encoding="utf-8"))
            trading = was_trading_day(data["bars"])
            if not trading:
                print(f"{data['date']}: almost no bars, so the market was closed. Skipping.")
            return trading

        @task
        def quality_checks(path: str) -> dict:
            from openwatch_pipeline import store
            from openwatch_pipeline.quality import QualityError, check_bars

            data = json.loads(Path(path).read_text(encoding="utf-8"))
            report = check_bars(data["bars"])
            store.ensure_indexes()
            store.save_quality_report(market_id, data["date"], report)
            print(
                f"{data['date']}: {report['with_bars']} of {report['symbols']} bars; "
                f"{len(report['missing'])} missing, {len(report['zero_volume'])} zero volume, "
                f"{len(report['big_moves'])} big moves"
            )
            if report["failure"]:
                raise QualityError(report["failure"])
            return {"symbols": report["symbols"], "missing": len(report["missing"])}

        @task
        def load(path: str, _quality: dict) -> int:
            from openwatch_pipeline import store

            data = json.loads(Path(path).read_text(encoding="utf-8"))
            by_symbol = {stock["yahoo"]: stock for stock in data["universe"]}
            rows = [
                {**by_symbol[symbol], **bar}
                for symbol, bar in data["bars"].items()
                if bar is not None
            ]
            written = store.upsert_daily_bars(market_id, data["date"], rows)
            print(f"{data['date']}: {len(rows)} daily bars loaded ({written} new or changed)")
            return len(rows)

        @task
        def publish_eod_ready(path: str, quality: dict, loaded: int) -> dict:
            from openwatch_pipeline.events import publish_eod_ready as publish

            day = json.loads(Path(path).read_text(encoding="utf-8"))["date"]
            event = publish(
                market_id,
                day,
                {"symbols": quality["symbols"], "loaded": loaded, "missing": quality["missing"]},
            )
            print(f"Published {event}")
            return event

        universe = build_universe()
        path = fetch_bars(universe)
        trading = check_trading_day(path)
        quality = quality_checks(path)
        trading >> quality
        loaded = load(path, quality)
        publish_eod_ready(path, quality, loaded)

    return eod_bars()


eod_bars_us = make_eod_dag("US", "30 16 * * 1-5")
eod_bars_in = make_eod_dag("IN", "0 16 * * 1-5")
