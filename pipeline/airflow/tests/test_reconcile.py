from datetime import date, datetime
from zoneinfo import ZoneInfo

from openwatch_pipeline.reconcile import day_bounds_ms, reconcile

CLOSES = {"ITC.NS": 282.85, "TCS.NS": 3000.0, "INFY.NS": 1149.0}


def streamed(ticker, price, source="replay", exchange="NSE"):
    return {"exchange": exchange, "ticker": ticker, "price": price, "asOf": 1, "source": source, "quotes": 74}


def test_no_stream_data_is_reported_not_failed():
    section = reconcile("IN", CLOSES, [])
    assert section["status"] == "no stream data"
    assert section["matched"] == 0 and section["drifted"] == []


def test_matching_prices_are_ok():
    section = reconcile("IN", CLOSES, [streamed("ITC", 282.85), streamed("TCS", 3003.0)])
    assert section["status"] == "ok"
    assert section["matched"] == 2
    assert section["coverage"] == round(2 / 3, 4)
    assert section["drifted"] == []
    assert section["max_abs_diff"] == 0.001
    assert section["sources"] == {"replay": 2}


def test_a_difference_over_the_threshold_is_listed_as_drift():
    section = reconcile("IN", CLOSES, [streamed("ITC", 282.85), streamed("INFY", 1170.0, source="live")])
    assert section["status"] == "drift"
    assert section["drifted"] == ["INFY.NS"]
    infy = next(s for s in section["stocks"] if s["symbol"] == "INFY.NS")
    assert infy["diff"] == round(1170 / 1149 - 1, 5)
    assert infy["source"] == "live"


def test_streamed_stocks_without_a_close_are_listed_separately():
    section = reconcile("IN", CLOSES, [streamed("ITC", 282.85), streamed("ZOMATO", 250.0)])
    assert section["unmatched"] == ["ZOMATO.NS"]
    assert section["matched"] == 1


def test_us_share_classes_join_on_the_yahoo_symbol():
    section = reconcile("US", {"BRK-B": 500.0}, [streamed("BRK.B", 500.0, exchange="NYSE")])
    assert section["matched"] == 1


def test_day_bounds_follow_the_market_time_zone():
    start, end = day_bounds_ms(date(2026, 11, 13), "Asia/Kolkata")
    tz = ZoneInfo("Asia/Kolkata")
    assert datetime.fromtimestamp(start / 1000, tz).isoformat() == "2026-11-13T00:00:00+05:30"
    assert end - start == 24 * 60 * 60 * 1000
