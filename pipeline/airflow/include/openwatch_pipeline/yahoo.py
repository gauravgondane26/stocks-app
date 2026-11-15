"""Daily bars from Yahoo's chart endpoint, the same source the app uses.

Requests carry the app's honest User-Agent (lib/market/http.ts). No browser disguise or
cookie tricks.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, time as dtime, timedelta
from typing import Callable, Mapping
from zoneinfo import ZoneInfo

BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
USER_AGENT = "OpenWatch/0.1 (personal portfolio project)"
# A week back covers weekends and short holidays, so the previous close is found.
LOOKBACK_DAYS = 8
BATCH_SIZE = 5
BATCH_PAUSE_SECONDS = 0.5


def day_window(day: date, time_zone: str) -> tuple[int, int]:
    """Epoch seconds from LOOKBACK_DAYS before `day` to the end of `day`, local time."""
    tz = ZoneInfo(time_zone)
    start = datetime.combine(day - timedelta(days=LOOKBACK_DAYS), dtime.min, tz)
    end = datetime.combine(day + timedelta(days=1), dtime.min, tz)
    return int(start.timestamp()), int(end.timestamp())


def parse_daily_bar(payload: Mapping, day: date, time_zone: str) -> dict | None:
    """The bar dated `day` (in the market's time zone) and the close before it.

    Returns None when Yahoo has no complete bar for that day. Yahoo stamps each daily
    bar at the session's open, so its local date is the trading day.
    """
    results = (payload.get("chart") or {}).get("result") or []
    if not results:
        return None
    result = results[0]
    timestamps = result.get("timestamp") or []
    quotes = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    tz = ZoneInfo(time_zone)

    previous_close = None
    for index, stamp in enumerate(timestamps):
        values = {
            field: (quotes.get(field) or [None] * len(timestamps))[index]
            for field in ("open", "high", "low", "close", "volume")
        }
        if any(values[field] is None for field in ("open", "high", "low", "close")):
            continue
        local_day = datetime.fromtimestamp(stamp, tz).date()
        if local_day < day:
            previous_close = values["close"]
        elif local_day == day:
            return {
                "open": float(values["open"]),
                "high": float(values["high"]),
                "low": float(values["low"]),
                "close": float(values["close"]),
                "volume": int(values["volume"] or 0),
                "previous_close": float(previous_close) if previous_close is not None else None,
                "time": int(stamp) * 1000,
            }
    return None


def fetch_chart(yahoo_symbol: str, day: date, time_zone: str, timeout: float = 15) -> dict:
    """Raw chart JSON for one symbol around `day`. Raises on network or HTTP errors."""
    period1, period2 = day_window(day, time_zone)
    query = urllib.parse.urlencode({"interval": "1d", "period1": period1, "period2": period2})
    url = f"{BASE_URL}/{urllib.parse.quote(yahoo_symbol, safe='')}?{query}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def fetch_daily_bars(
    yahoo_symbols: list[str],
    day: date,
    time_zone: str,
    fetch: Callable[[str, date, str], dict] = fetch_chart,
    pause: Callable[[float], None] = time.sleep,
) -> dict[str, dict | None]:
    """Each symbol's bar for `day` (None when missing or the request failed).

    Same pace as the app: batches of 5 in parallel, half a second apart.
    """

    def one(symbol: str) -> dict | None:
        try:
            return parse_daily_bar(fetch(symbol, day, time_zone), day, time_zone)
        except (urllib.error.URLError, TimeoutError, ValueError, OSError):
            return None

    bars: dict[str, dict | None] = {}
    with ThreadPoolExecutor(max_workers=BATCH_SIZE) as pool:
        for start in range(0, len(yahoo_symbols), BATCH_SIZE):
            if start:
                pause(BATCH_PAUSE_SECONDS)
            batch = yahoo_symbols[start : start + BATCH_SIZE]
            for symbol, bar in zip(batch, pool.map(one, batch)):
                bars[symbol] = bar
    return bars
