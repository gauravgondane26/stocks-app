import json
import urllib.error
from datetime import date, datetime
from zoneinfo import ZoneInfo

from conftest import FIXTURES

from openwatch_pipeline.yahoo import day_window, fetch_daily_bars, parse_daily_bar

NY = "America/New_York"
# Yahoo's real response for AAPL, 2026-11-05 to 2026-11-13 (trimmed to the fields used).
AAPL = json.loads((FIXTURES / "yahoo-aapl-2026-11-13.json").read_text(encoding="utf-8"))


def test_parses_the_days_bar_and_the_close_before_it():
    bar = parse_daily_bar(AAPL, date(2026, 11, 13), NY)
    assert bar is not None
    assert round(bar["close"], 2) == 356.27
    assert round(bar["previous_close"], 2) == 354.88
    assert bar["volume"] == 39_985_300
    assert bar["low"] <= bar["close"] <= bar["high"]
    # Stamped at the session's open, 09:30 in New York.
    assert datetime.fromtimestamp(bar["time"] / 1000, ZoneInfo(NY)).strftime("%Y-%m-%d %H:%M") == "2026-11-13 09:30"


def test_a_weekend_has_no_bar():
    assert parse_daily_bar(AAPL, date(2026, 11, 8), NY) is None


def test_a_bar_with_missing_prices_is_skipped():
    payload = json.loads(json.dumps(AAPL))
    quote = payload["chart"]["result"][0]["indicators"]["quote"][0]
    quote["close"][-1] = None
    assert parse_daily_bar(payload, date(2026, 11, 13), NY) is None


def test_an_empty_or_error_response_has_no_bar():
    assert parse_daily_bar({"chart": {"result": None, "error": {"code": "Not Found"}}}, date(2026, 11, 13), NY) is None
    assert parse_daily_bar({}, date(2026, 11, 13), NY) is None


def test_day_window_covers_the_lookback_to_the_end_of_the_day_in_market_time():
    start, end = day_window(date(2026, 11, 13), "Asia/Kolkata")
    tz = ZoneInfo("Asia/Kolkata")
    assert datetime.fromtimestamp(start, tz).isoformat() == "2026-11-05T00:00:00+05:30"
    assert datetime.fromtimestamp(end, tz).isoformat() == "2026-11-14T00:00:00+05:30"


def test_fetch_daily_bars_batches_and_turns_failures_into_none():
    pauses = []

    def fake_fetch(symbol, day, tz):
        if symbol == "BAD":
            raise urllib.error.URLError("boom")
        return AAPL

    symbols = ["A", "B", "C", "D", "E", "F", "BAD"]
    bars = fetch_daily_bars(symbols, date(2026, 11, 13), NY, fetch=fake_fetch, pause=pauses.append)
    assert set(bars) == set(symbols)
    assert bars["BAD"] is None
    assert all(bars[s] is not None for s in symbols if s != "BAD")
    assert pauses == [0.5]  # one pause between the two batches of 5
