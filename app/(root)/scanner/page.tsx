import { Star } from "lucide-react";
import Link from "next/link";

import RunScanButton from "@/components/RunScanButton";
import type { ScanDocument } from "@/database/models/scan.model";
import { requireUser } from "@/lib/better-auth/session";
import { getCurrentMarket } from "@/lib/market/current";
import { formatMoney } from "@/lib/market/format";
import { MARKETS } from "@/lib/market/markets";
import { stockPath } from "@/lib/market/symbols";
import type { MarketId } from "@/lib/market/types";
import { findLatestScan, getIndexInfo, marketClockLabel } from "@/lib/scanner";
import { DAILY_SETUPS, type DailyHit, type OrbHit } from "@/lib/trade/scanner";
import { toHHMM, toMinutes } from "@/lib/trade/session";
import { findWatchedTickers } from "@/lib/watchlist";

type LoadedScan = (ScanDocument & { createdAt: Date }) | null;

const loadScans = async (market: MarketId, userId: string) => {
  try {
    const [daily, orb, watched] = await Promise.all([
      findLatestScan(market, "daily", userId),
      findLatestScan(market, "orb", userId),
      findWatchedTickers(userId, market),
    ]);
    return { ok: true as const, daily, orb, watched };
  } catch (error) {
    console.error("Load scans failed:", error);
    return { ok: false as const };
  }
};

// A scheduled scan covers every user's watchlist, so each person only sees hits from
// the index and their own watchlist.
const visibleHits = <T extends { ticker: string }>(
  scan: LoadedScan,
  allowed: Set<string>,
): T[] => ((scan?.hits ?? []) as unknown as T[]).filter(({ ticker }) => allowed.has(ticker));

const ScanSummary = ({ scan, market }: { scan: LoadedScan; market: MarketId }) => {
  if (!scan) return <p className="text-sm text-gray-500">No scan yet.</p>;
  const { counts } = scan;
  const failed = (counts.requested ?? 0) - (counts.scanned ?? 0);
  const gappedChecked = counts.gappedChecked ?? 0;
  const unchecked = (counts.unconfirmed ?? 0) + (counts.gappedUnchecked ?? 0);
  return (
    <p className="text-sm text-gray-500">
      {scan.universe.index} plus watchlists: {counts.scanned} of {counts.requested} charts
      scanned
      {failed > 0 &&
        ` (${failed} had no data or ${failed === 1 ? "was" : "were"} incomplete${
          gappedChecked > 0 ? `; ${gappedChecked} of those checked with full charts instead` : ""
        })`}
      . Data for{" "}
      {scan.dataDate}
      {scan.cutoff && ` up to ${scan.cutoff}`}, scanned {marketClockLabel(market, scan.createdAt)}{" "}
      market time{scan.userId ? " (your run)" : ""}.
      {unchecked > 0 && ` Partial: ${unchecked} stocks that might have broken out weren't checked.`}
    </p>
  );
};

const WatchStar = ({ watched }: { watched: boolean }) =>
  watched ? (
    <Star aria-label="In your watchlist" className="inline size-3.5 fill-yellow-500 text-yellow-500" />
  ) : null;

const ScannerPage = async () => {
  const user = await requireUser();
  const market = await getCurrentMarket();
  const { open, close, label } = MARKETS[market];
  const { index, members } = getIndexInfo(market);
  const loaded = await loadScans(market, user.id);

  if (!loaded.ok) {
    return (
      <p className="py-20 text-center text-gray-500">
        Scans couldn&apos;t be loaded. Please try again.
      </p>
    );
  }

  const allowed = new Set([...members.map(({ ticker }) => ticker), ...loaded.watched]);
  const dailyHits = visibleHits<DailyHit>(loaded.daily, allowed);
  const orbHits = visibleHits<OrbHit>(loaded.orb, allowed);
  const money = (value: number) => formatMoney(value, market);

  return (
    <div className="flex w-full flex-col gap-10">
      <div>
        <h1 className="watchlist-title">{label} Scanner</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-500">
          Scans the {index} ({members.length} stocks) plus your watchlist for chart
          setups. Scans run by themselves on trading days, and you can run one now.
          A scan is a list of charts that match a rule, not a list of stocks to
          buy, and a setup is not a prediction. Data is delayed. Not financial
          advice.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-100">Opening-range breakouts</h2>
          <RunScanButton mode="orb" label="Run breakout scan" />
        </div>
        <p className="text-sm text-gray-500">
          The first 5-minute bar to close above the high of the first 15 minutes.
          Runs at {toHHMM(toMinutes(open) + 45)} market time, or by hand during the
          session. A later hit is closer to the price now.
        </p>
        <ScanSummary scan={loaded.orb} market={market} />
        {loaded.orb && (
          <div className="watchlist-table overflow-x-auto!">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="table-header-row">
                  {["Time", "Company", "Symbol", "Close", "Opening range", "Over"].map((heading) => (
                    <th key={heading} className="px-3 py-3 font-medium first:pl-4">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orbHits.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No chart closed above its opening range.</td></tr>
                )}
                {orbHits.map((hit) => (
                  <tr key={hit.ticker} className="table-row">
                    <td className="table-cell py-3 pr-3 pl-4">{hit.at}</td>
                    <td className="table-cell px-3 py-3">
                      <Link href={stockPath({ market, ticker: hit.ticker })} className="hover:text-yellow-500">{hit.name}</Link>{" "}
                      <WatchStar watched={loaded.watched.has(hit.ticker)} />
                    </td>
                    <td className="table-cell px-3 py-3 text-gray-400">{hit.ticker}</td>
                    <td className="table-cell px-3 py-3">{money(hit.price)}</td>
                    <td className="table-cell px-3 py-3 text-gray-400">{money(hit.orLow)} to {money(hit.orHigh)}</td>
                    <td className="table-cell px-3 py-3">+{hit.pctOver.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-100">Daily setups</h2>
          <RunScanButton mode="daily" label="Run daily scan" />
        </div>
        <p className="text-sm text-gray-500">
          Rules on daily closes: a 20-day closing-high breakout, a bull flag, a
          reclaim of the 20-day average, oversold (RSI under 30) and an oversold
          bounce. Runs 30 minutes after the {close} close; today&apos;s bar counts
          only once the session has closed.
        </p>
        <ScanSummary scan={loaded.daily} market={market} />
        {loaded.daily && (
          <div className="watchlist-table overflow-x-auto!">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="table-header-row">
                  {["Company", "Symbol", "Setups", "Close", "RSI"].map((heading) => (
                    <th key={heading} className="px-3 py-3 font-medium first:pl-4">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyHits.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No chart matched a rule.</td></tr>
                )}
                {dailyHits.map((hit) => (
                  <tr key={hit.ticker} className="table-row">
                    <td className="table-cell py-3 pr-3 pl-4">
                      <Link href={stockPath({ market, ticker: hit.ticker })} className="hover:text-yellow-500">{hit.name}</Link>{" "}
                      <WatchStar watched={loaded.watched.has(hit.ticker)} />
                    </td>
                    <td className="table-cell px-3 py-3 text-gray-400">{hit.ticker}</td>
                    <td className="table-cell px-3 py-3 text-sm">
                      {hit.setups.map((setup) => DAILY_SETUPS[setup]).join(", ")}
                    </td>
                    <td className="table-cell px-3 py-3">{money(hit.price)}</td>
                    <td className="table-cell px-3 py-3 text-gray-400">{hit.rsi ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ScannerPage;
