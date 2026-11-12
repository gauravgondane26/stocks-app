import { Star } from "lucide-react";
import Link from "next/link";

import AlertsList from "@/components/AlertsList";
import CreateAlertButton from "@/components/CreateAlertButton";
import OpenSearchButton from "@/components/OpenSearchButton";
import WatchlistButton from "@/components/WatchlistButton";
import { getAlerts } from "@/lib/actions/alert.actions";
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
import type { MarketId } from "@/lib/market/types";

const DASH = "—";

const loadRow = async (entry: WatchlistEntry) => {
  const data = getMarketData(entry.symbol.market);
  const [quote, profile] = await Promise.all([
    data.quote(entry.symbol),
    data.profile(entry.symbol),
  ]);
  return { entry, quote, profile };
};

const WatchlistTable = async ({
  entries,
  market,
  alerts,
}: {
  entries: WatchlistEntry[];
  market: MarketId;
  alerts: AlertEntry[];
}) => {
  const rows = await Promise.all(entries.map(loadRow));
  const activeAlerts = new Map<string, number>();
  for (const { status, symbol } of alerts) {
    if (status !== "active") continue;
    activeAlerts.set(symbol.ticker, (activeAlerts.get(symbol.ticker) ?? 0) + 1);
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="watchlist-title">{MARKETS[market].label} Watchlist</h1>
        <p className="text-sm text-gray-500">
          Prices are delayed and for information only.
        </p>
      </div>
      <div className="watchlist-table overflow-x-auto!">
        <table className="w-full min-w-[860px] text-left">
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
              const alertCount = activeAlerts.get(symbol.ticker) ?? 0;

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
                  <td className="table-cell px-3 py-3">
                    <div className="flex items-center gap-2">
                      <CreateAlertButton symbol={symbol} company={company} />
                      {alertCount > 0 && (
                        <span className="text-sm whitespace-nowrap text-gray-500">
                          {alertCount} active
                        </span>
                      )}
                    </div>
                  </td>
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
    </>
  );
};

const WatchlistPage = async () => {
  await requireUser("/watchlist");

  const market = await getCurrentMarket();
  const [watchlist, alerts] = await Promise.all([
    getWatchlist(market),
    getAlerts(market),
  ]);
  const alertEntries = alerts.ok ? alerts.data : null;

  return (
    <div className="watchlist-container w-full">
      <section className="watchlist flex flex-col gap-4 space-y-0! min-w-0">
        {!watchlist.ok && (
          <p className="py-20 text-center text-gray-500">
            Your watchlist couldn&apos;t be loaded. Please try again.
          </p>
        )}
        {watchlist.ok && watchlist.data.length === 0 && (
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
        )}
        {watchlist.ok && watchlist.data.length > 0 && (
          <WatchlistTable
            entries={watchlist.data}
            market={market}
            alerts={alertEntries ?? []}
          />
        )}
      </section>
      <aside className="watchlist-alerts">
        <AlertsList alerts={alertEntries} market={market} />
      </aside>
    </div>
  );
};

export default WatchlistPage;
