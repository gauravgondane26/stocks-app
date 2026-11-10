import { notFound } from "next/navigation";

import CreateAlertButton from "@/components/CreateAlertButton";
import StockWidgets from "@/components/StockWidgets";
import TradePlanPanel from "@/components/TradePlanPanel";
import WatchlistButton from "@/components/WatchlistButton";
import { isInWatchlist } from "@/lib/actions/watchlist.actions";
import { requireUser } from "@/lib/better-auth/session";
import { getMarketData } from "@/lib/market";
import { getChartListing } from "@/lib/market/charts";
import { formatMoney, formatPercent } from "@/lib/market/format";
import { symbolFromRoute, toTradingView } from "@/lib/market/symbols";
import { loadTradePlan } from "@/lib/trade/load";

type StockPageProps = {
  params: Promise<{ market: string; ticker: string }>;
};

const StockPage = async ({ params }: StockPageProps) => {
  await requireUser();

  const { market, ticker } = await params;
  const routeSymbol = symbolFromRoute(market, ticker);
  if (!routeSymbol) notFound();

  const data = getMarketData(routeSymbol.market);
  const [profile, quote, watched] = await Promise.all([
    data.profile(routeSymbol),
    data.quote(routeSymbol),
    isInWatchlist(routeSymbol),
  ]);

  // One source not knowing a ticker isn't enough, such as a US ETF Finnhub has no profile for.
  if (
    !profile.ok &&
    profile.reason === "not_found" &&
    !quote.ok &&
    quote.reason === "not_found"
  ) {
    notFound();
  }

  // The profile is what tells NASDAQ from NYSE.
  const symbol = profile.ok ? profile.data.symbol : routeSymbol;
  const company = profile.ok ? profile.data.name : symbol.ticker;
  const [chartListing, tradePlan] = await Promise.all([
    getChartListing(symbol),
    loadTradePlan(symbol, quote),
  ]);
  const changePercent = quote.ok ? quote.data.changePercent : null;

  return (
    <div className="flex w-full flex-col gap-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 md:text-3xl">
            {company}
          </h1>
          <p className="mt-1 text-gray-500">
            {symbol.ticker} · {symbol.exchange}
          </p>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            {quote.ok ? (
              <>
                <span className="text-2xl font-semibold text-gray-100">
                  {formatMoney(quote.data.price, symbol.market)}
                </span>
                {changePercent != null && (
                  <span
                    className={
                      changePercent >= 0 ? "text-teal-400" : "text-red-500"
                    }
                  >
                    {formatPercent(changePercent)}
                  </span>
                )}
                <span className="text-sm text-gray-500">Delayed</span>
              </>
            ) : (
              <span className="text-gray-500">Price data unavailable</span>
            )}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-64">
          <WatchlistButton
            symbol={symbol}
            company={company}
            isInWatchlist={watched}
          />
          <CreateAlertButton
            symbol={symbol}
            company={company}
            className="w-full justify-center"
          />
        </div>
      </section>

      {/* Keyed so moving to another stock starts a fresh plan. */}
      <TradePlanPanel
        key={`${symbol.market}:${symbol.ticker}`}
        market={symbol.market}
        ticker={symbol.ticker}
        {...tradePlan}
      />

      {chartListing.available ? (
        <>
          {chartListing.otherExchange && (
            <p className="text-sm text-gray-500">
              Charts show the {chartListing.otherExchange} listing, so their
              prices can differ slightly from the {symbol.exchange} price above.
            </p>
          )}
          <StockWidgets symbol={toTradingView(symbol)} />
        </>
      ) : (
        <p className="rounded-lg border border-gray-600 bg-gray-800 p-6 text-center text-gray-500">
          Charts aren&apos;t available for this stock because it has no{" "}
          {chartListing.otherExchange} listing.
        </p>
      )}
    </div>
  );
};

export default StockPage;
