import json
import os
from pathlib import Path

import pytest

from openwatch_pipeline.universe import Stock, build_universe, index_members, to_yahoo

# The repo root locally and in CI; the container mounts the data under OPENWATCH_REPO.
REPO = Path(os.environ.get("OPENWATCH_REPO") or Path(__file__).resolve().parents[3])
MEMBERS = {
    "US": {"members": [{"ticker": "AAPL"}, {"ticker": "BRK.B"}, {"ticker": "KO"}]},
    "IN": {"members": [{"ticker": "ITC"}, {"ticker": "M&M"}]},
}


@pytest.mark.parametrize(
    ("stock", "yahoo"),
    [
        (Stock("US", "NASDAQ", "AAPL"), "AAPL"),
        (Stock("US", "NYSE", "BRK.B"), "BRK-B"),
        (Stock("IN", "NSE", "RELIANCE"), "RELIANCE.NS"),
        (Stock("IN", "BSE", "RELIANCE"), "RELIANCE.BO"),
        (Stock("IN", "NSE", "M&M"), "M&M.NS"),
    ],
)
def test_to_yahoo_matches_the_app(stock, yahoo):
    assert to_yahoo(stock) == yahoo


def test_index_members_use_the_default_exchange():
    assert index_members(MEMBERS, "IN") == [Stock("IN", "NSE", "ITC"), Stock("IN", "NSE", "M&M")]
    assert index_members({}, "US") == []


def test_build_universe_merges_watchlists_and_keeps_their_exchange():
    rows = [
        {"exchange": "NYSE", "ticker": "KO"},  # also an index member
        {"exchange": "NYSE", "ticker": "JPM"},
    ]
    universe = build_universe("US", MEMBERS, rows)
    assert [s.yahoo for s in universe] == ["AAPL", "BRK-B", "JPM", "KO"]
    assert next(s for s in universe if s.ticker == "KO").exchange == "NYSE"


def test_build_universe_keeps_one_ticker_on_two_indian_exchanges():
    universe = build_universe("IN", MEMBERS, [{"exchange": "BSE", "ticker": "ITC"}])
    assert sorted(s.yahoo for s in universe) == ["ITC.BO", "ITC.NS", "M&M.NS"]


def test_unknown_market_is_rejected():
    with pytest.raises(ValueError):
        index_members(MEMBERS, "UK")


def test_the_real_index_file_loads():
    members = json.loads((REPO / "lib/market/data/index-members.json").read_text(encoding="utf-8"))
    assert len(index_members(members, "US")) > 400
    assert len(index_members(members, "IN")) == 50
