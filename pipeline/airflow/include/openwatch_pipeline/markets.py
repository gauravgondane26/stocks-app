"""Market settings the batch jobs need, mirroring lib/market/markets.ts in the app.

Keep these in step with that file: time zones, exchanges and Yahoo suffixes.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Market:
    id: str
    time_zone: str
    # Exchange code -> Yahoo suffix. The first exchange is the default, used for index
    # members, which don't name one.
    exchanges: dict[str, str]
    index_name: str

    @property
    def default_exchange(self) -> str:
        return next(iter(self.exchanges))


MARKETS: dict[str, Market] = {
    "US": Market(
        id="US",
        time_zone="America/New_York",
        exchanges={"NASDAQ": "", "NYSE": "", "AMEX": ""},
        index_name="S&P 500",
    ),
    "IN": Market(
        id="IN",
        time_zone="Asia/Kolkata",
        exchanges={"NSE": ".NS", "BSE": ".BO"},
        index_name="NIFTY 50",
    ),
}


def get_market(market_id: str) -> Market:
    try:
        return MARKETS[market_id]
    except KeyError:
        raise ValueError(f"unknown market {market_id!r}") from None
