"""Checks on a day's bars before they're loaded."""

from __future__ import annotations

from typing import Mapping

# Fewer bars than this share of the universe means the market was closed that day
# (weekend or holiday), so the run skips instead of failing. No copy of the holiday
# calendar is needed.
TRADING_DAY_MIN_SHARE = 0.2
# On a trading day, more missing bars than this share fails the run, so a broken
# Yahoo day shows up in Airflow instead of loading quietly.
MAX_MISSING_SHARE = 0.10
# A daily move bigger than this is flagged for a look (splits, bad prints).
BIG_MOVE_SHARE = 0.20


class QualityError(Exception):
    """The day's data is too incomplete to load."""


def was_trading_day(bars: Mapping[str, dict | None]) -> bool:
    if not bars:
        return False
    present = sum(1 for bar in bars.values() if bar is not None)
    return present / len(bars) >= TRADING_DAY_MIN_SHARE


def check_bars(bars: Mapping[str, dict | None]) -> dict:
    """A report of what looks wrong. `failure` is set when the run should fail; the DAG
    saves the report first, then raises QualityError, so a bad day still leaves a record."""
    missing = sorted(symbol for symbol, bar in bars.items() if bar is None)
    present = {symbol: bar for symbol, bar in bars.items() if bar is not None}

    zero_volume = sorted(symbol for symbol, bar in present.items() if bar["volume"] == 0)
    inverted = sorted(symbol for symbol, bar in present.items() if bar["high"] < bar["low"])
    outside_range = sorted(
        symbol
        for symbol, bar in present.items()
        if bar["high"] >= bar["low"] and not bar["low"] <= bar["close"] <= bar["high"]
    )
    big_moves = sorted(
        (
            {"symbol": symbol, "move": round(bar["close"] / bar["previous_close"] - 1, 4)}
            for symbol, bar in present.items()
            if bar.get("previous_close") and abs(bar["close"] / bar["previous_close"] - 1) > BIG_MOVE_SHARE
        ),
        key=lambda item: item["symbol"],
    )

    total = len(bars)
    missing_share = len(missing) / total if total else 1.0
    failure = None
    if missing_share > MAX_MISSING_SHARE:
        failure = (
            f"{len(missing)} of {total} symbols have no bar ({missing_share:.0%}, "
            f"limit {MAX_MISSING_SHARE:.0%})"
        )
    # Bars with high below low are impossible, so they fail the run too. Other flags
    # (zero volume, big moves, a close outside the range) are warnings to look at.
    elif inverted:
        failure = f"{len(inverted)} bar(s) have high below low: {', '.join(inverted[:10])}"

    return {
        "symbols": total,
        "with_bars": len(present),
        "missing": missing,
        "missing_share": round(missing_share, 4),
        "zero_volume": zero_volume,
        "high_below_low": inverted,
        "close_outside_range": outside_range,
        "big_moves": big_moves,
        "passed": failure is None,
        "failure": failure,
    }
