"""Which stocks an end-of-day run covers: the market's index plus every watchlist."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping

from .markets import get_market


@dataclass(frozen=True, order=True)
class Stock:
    market: str
    exchange: str
    ticker: str

    @property
    def yahoo(self) -> str:
        return to_yahoo(self)

    def to_dict(self) -> dict[str, str]:
        return {"market": self.market, "exchange": self.exchange, "ticker": self.ticker}


def to_yahoo(stock: Stock) -> str:
    """Yahoo's symbol, as toYahoo() in lib/market/symbols.ts builds it.

    US share classes use a dash (BRK.B is BRK-B), and Indian listings take the
    exchange suffix (.NS for NSE, .BO for BSE).
    """
    market = get_market(stock.market)
    suffix = market.exchanges.get(stock.exchange, market.exchanges[market.default_exchange])
    return stock.ticker.replace(".", "-") + suffix


def index_members(members_json: Mapping, market_id: str) -> list[Stock]:
    """Stocks from lib/market/data/index-members.json, on the market's default exchange."""
    market = get_market(market_id)
    entry = members_json.get(market_id) or {}
    return [
        Stock(market_id, market.default_exchange, member["ticker"].strip().upper())
        for member in entry.get("members", [])
        if member.get("ticker")
    ]


def build_universe(
    market_id: str,
    members_json: Mapping,
    watchlist_rows: Iterable[Mapping],
) -> list[Stock]:
    """Index members plus watchlist stocks, one entry per Yahoo symbol, sorted.

    A watchlist row wins over an index member with the same Yahoo symbol, because it
    names the real exchange (KO on NYSE rather than the default NASDAQ).
    """
    by_symbol: dict[str, Stock] = {}
    for stock in index_members(members_json, market_id):
        by_symbol.setdefault(stock.yahoo, stock)
    for row in watchlist_rows:
        stock = Stock(market_id, str(row["exchange"]).upper(), str(row["ticker"]).upper())
        by_symbol[stock.yahoo] = stock
    return sorted(by_symbol.values())
