import { Star } from "lucide-react";
import Link from "next/link";

import OpenSearchButton from "@/components/OpenSearchButton";
import WatchlistButton from "@/components/WatchlistButton";
import { getWatchlist } from "@/lib/actions/watchlist.actions";
import { requireUser } from "@/lib/better-auth/session";
import { WATCHLIST_TABLE_HEADER } from "@/lib/constants";
import { getMarketData } from "@/lib/market";
import { getCurrentMarket } from "@/lib/market/current";
import {
  formatCompactMoney,
  formatMoney,
  formatPercent,
} from "@/lib/market/format";
import { MARKETS } from "@/lib/market/markets";
import { stockPath } from "@/lib/market/symbols";

const DASH = "—";

const loadRow = async (entry: WatchlistEntry) => {
  const data = getMarketData(entry.symbol.market);
  const [quote, profile] = await Promise.all([
    data.quote(entry.symbol),
    data.profile(entry.symbol),
  ]);
  return { entry, quote, profile };
};

const WatchlistPage = async () => {
  await requireUser();

  const market = await getCurrentMarket();
  const watchlist = await getWatchlist(market);

  if (!watchlist.ok) {
    return (
      <p className="py-20 text-center text-gray-500">
        Your watchlist couldn&apos;t be loaded. Please try again.
      </p>
    );
  }

  if (watchlist.data.length === 0) {
    return (
      <div className="watchlist-empty py-20">
        <Star className="watchlist-star" />
        <h1 className="empty-title">
          No {MARKETS[market].label} stocks in your watchlist
        </h1>
        <p className="empty-description">
          Search for a stock and add it to follow it here.
        </p>
        <OpenSearchButton label="Search stocks" />
      </div>
    );
  }

  const rows = await Promise.all(watchlist.data.map(loadRow));

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="watchlist-title">{MARKETS[market].label} Watchlist</h1>
        <p className="text-sm text-gray-500">
          Prices are delayed and for information only.
        </p>
      </div>
      <div className="watchlist-table overflow-x-auto!">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="table-header-row">
              {WATCHLIST_TABLE_HEADER.map((label) => (
                <th key={label} className="table-header px-3 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, quote, profile }) => {
              const { symbol, company } = entry;
              const path = stockPath(symbol);
              const changePercent = quote.ok ? quote.data.changePercent : null;
              const marketCap = profile.ok ? profile.data.marketCap : null;
              const peRatio = profile.ok ? profile.data.peRatio : null;

              return (
                <tr key={symbol.ticker} className="table-row">
                  <td className="table-cell py-3 pr-3 pl-4">
                    <Link href={path} className="hover:text-yellow-500">
                      {company}
                    </Link>
                  </td>
                  <td className="table-cell px-3 py-3 text-gray-400">
                    <Link href={path} className="hover:text-yellow-500">
                      {symbol.ticker}
                    </Link>
                  </td>
                  <td className="table-cell px-3 py-3">
                    {quote.ok ? (
                      formatMoney(quote.data.price, market)
                    ) : (
                      <span className="text-gray-500">Data unavailable</span>
                    )}
                  </td>
                  <td
                    className={`table-cell px-3 py-3 ${
                      changePercent == null
                        ? "text-gray-500"
                        : changePercent >= 0
                          ? "text-teal-400"
                          : "text-red-500"
                    }`}
                  >
                    {changePercent == null ? DASH : formatPercent(changePercent)}
                  </td>
                  <td className="table-cell px-3 py-3">
                    {marketCap == null
                      ? DASH
                      : formatCompactMoney(marketCap, market)}
                  </td>
                  <td className="table-cell px-3 py-3">
                    {peRatio == null ? DASH : peRatio.toFixed(2)}
                  </td>
                  <td className="table-cell px-3 py-3 text-gray-500">{DASH}</td>
                  <td className="table-cell px-3 py-3">
                    <WatchlistButton
                      symbol={symbol}
                      company={company}
                      isInWatchlist
                      variant="icon"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default WatchlistPage;
