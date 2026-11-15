from openwatch_pipeline.quality import check_bars, was_trading_day


def bar(close=100.0, high=101.0, low=99.0, volume=1000, previous_close=99.5):
    return {"open": close, "high": high, "low": low, "close": close, "volume": volume, "previous_close": previous_close}


def test_a_clean_day_passes():
    report = check_bars({f"S{i}": bar() for i in range(20)})
    assert report["passed"] is True
    assert report["failure"] is None
    assert report["with_bars"] == 20 and report["missing"] == []


def test_flags_zero_volume_big_moves_and_a_close_outside_the_range_as_warnings():
    report = check_bars(
        {
            "QUIET": bar(volume=0),
            "JUMP": bar(close=130.0, high=131.0, low=99.0, previous_close=100.0),
            "ODD": bar(close=105.0, high=101.0, low=99.0),
            **{f"S{i}": bar() for i in range(20)},
        }
    )
    assert report["zero_volume"] == ["QUIET"]
    assert report["big_moves"] == [{"symbol": "JUMP", "move": 0.3}]
    assert report["close_outside_range"] == ["ODD"]
    assert report["passed"] is True


def test_more_than_ten_percent_missing_fails_the_run():
    bars = {f"S{i}": bar() for i in range(8)} | {"GONE1": None, "GONE2": None}
    report = check_bars(bars)
    assert report["passed"] is False
    assert report["missing"] == ["GONE1", "GONE2"]
    assert "2 of 10" in report["failure"]


def test_exactly_ten_percent_missing_still_passes():
    report = check_bars({f"S{i}": bar() for i in range(9)} | {"GONE": None})
    assert report["passed"] is True


def test_high_below_low_fails_the_run():
    report = check_bars({"BROKEN": bar(high=98.0, low=99.0), **{f"S{i}": bar() for i in range(20)}})
    assert report["high_below_low"] == ["BROKEN"]
    assert report["passed"] is False


def test_a_missing_previous_close_skips_the_move_check():
    assert check_bars({"NEW": bar(previous_close=None)})["big_moves"] == []


def test_trading_day_needs_a_fifth_of_the_stocks_to_have_bars():
    assert was_trading_day({"A": bar(), "B": None, "C": None, "D": None, "E": None}) is True
    assert was_trading_day({"A": bar(), **{f"N{i}": None for i in range(9)}}) is False
    assert was_trading_day({}) is False
