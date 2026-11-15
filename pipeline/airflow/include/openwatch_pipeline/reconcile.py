"""Stream vs batch: the Kafka archiver's last price for each stock against the official
daily close loaded by the same run.

It only reports; it never fails a run. Some difference is expected and is itself the
finding: the producer stops polling at the close, quotes are delayed, and NSE's official
close has been a weighted average of late trades rather than the last trade (check the
exchange's current method before reading much into Indian differences).
"""

from __future__ import annotations

from datetime import date, datetime, time as dtime, timedelta
from statistics import median
from typing import Iterable, Mapping
from zoneinfo import ZoneInfo

from .universe import Stock

# A difference above this share is listed as drift. A starting point, to tune after
# seeing real runs.
DRIFT_THRESHOLD = 0.01


def day_bounds_ms(day: date, time_zone: str) -> tuple[int, int]:
    """Epoch milliseconds of the start and end of `day` in the market's time zone."""
    tz = ZoneInfo(time_zone)
    start = datetime.combine(day, dtime.min, tz)
    end = datetime.combine(day + timedelta(days=1), dtime.min, tz)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000)


def reconcile(
    market: str,
    closes: Mapping[str, float],
    streamed: Iterable[Mapping],
    threshold: float = DRIFT_THRESHOLD,
) -> dict:
    """Compare streamed last prices with official closes.

    `closes` maps Yahoo symbol -> official close for the day. `streamed` holds one row
    per stock from intraday_quotes (exchange, ticker, price, asOf, source, quotes).
    Returns the `stream` section of the day's quality report.
    """
    rows = list(streamed)
    if not rows:
        return {
            "status": "no stream data",
            "note": "No archived quotes for this day: the Kafka worker wasn't running, "
            "or the day is older than intraday_quotes' 7-day TTL.",
            "with_close": len(closes),
            "streamed": 0,
            "matched": 0,
            "drifted": [],
            "threshold": threshold,
        }

    stocks, unmatched = [], []
    sources: dict[str, int] = {}
    for row in rows:
        yahoo = Stock(market, str(row["exchange"]), str(row["ticker"])).yahoo
        sources[row["source"]] = sources.get(row["source"], 0) + 1
        close = closes.get(yahoo)
        if not close:
            unmatched.append(yahoo)
            continue
        diff = row["price"] / close - 1
        stocks.append(
            {
                "symbol": yahoo,
                "streamed": row["price"],
                "close": close,
                "diff": round(diff, 5),
                "source": row["source"],
                "lastQuoteAt": row["asOf"],
                "quotes": row.get("quotes"),
            }
        )

    stocks.sort(key=lambda item: item["symbol"])
    abs_diffs = [abs(item["diff"]) for item in stocks]
    drifted = [item for item in stocks if abs(item["diff"]) > threshold]
    return {
        "status": "drift" if drifted else "ok" if stocks else "no matching stocks",
        "with_close": len(closes),
        "streamed": len(rows),
        "matched": len(stocks),
        "coverage": round(len(stocks) / len(closes), 4) if closes else 0.0,
        "sources": sources,
        "unmatched": sorted(unmatched),
        "threshold": threshold,
        "drifted": [item["symbol"] for item in drifted],
        "max_abs_diff": round(max(abs_diffs), 5) if abs_diffs else None,
        "median_abs_diff": round(median(abs_diffs), 5) if abs_diffs else None,
        "stocks": stocks,
    }
