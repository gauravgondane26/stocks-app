import Link from "next/link";

import AlertActions from "@/components/AlertActions";
import { describeAlert } from "@/lib/alerts/describe";
import { formatMarketDateTime, formatMoney } from "@/lib/market/format";
import { MARKETS } from "@/lib/market/markets";
import { stockPath } from "@/lib/market/symbols";
import type { MarketId } from "@/lib/market/types";

const rangText = (alert: AlertEntry, market: MarketId) => {
  if (alert.rangAt === null) return "Rang";
  const when = formatMarketDateTime(alert.rangAt, market);
  return alert.rangPrice === null
    ? `Rang ${when}`
    : `Rang ${when} at ${formatMoney(alert.rangPrice, market)}`;
};

const AlertsList = ({
  alerts,
  market,
}: {
  alerts: AlertEntry[] | null;
  market: MarketId;
}) => (
  <>
    <div className="w-full">
      <h2 className="watchlist-title">Alerts</h2>
      <p className="mt-1 text-sm text-gray-500">
        Checked every 5 minutes while the market is open. Quotes can be delayed,
        so an alert may arrive up to about 15 minutes late.
      </p>
    </div>
    <div className="alert-list">
      {alerts === null && (
        <p className="alert-empty">Your alerts couldn&apos;t be loaded.</p>
      )}
      {alerts?.length === 0 && (
        <p className="alert-empty">
          No {MARKETS[market].label} alerts yet. Add one from a stock.
        </p>
      )}
      {alerts?.map((alert) => (
        <article key={alert.id} className="alert-item">
          <p className="alert-name">{alert.label ?? alert.symbol.ticker}</p>
          <div className="alert-details border-gray-600">
            <Link
              href={stockPath(alert.symbol)}
              className="alert-company hover:text-yellow-500"
            >
              {alert.company}
            </Link>
            <span className="text-sm text-gray-500">{alert.symbol.ticker}</span>
          </div>
          <div className="alert-actions">
            <div>
              <p className="alert-price text-sm">
                {describeAlert(alert, market)}
              </p>
              <p
                className={`mt-1 text-sm ${
                  alert.status === "rang" ? "text-teal-400" : "text-gray-500"
                }`}
              >
                {alert.status === "rang" ? rangText(alert, market) : "Active"}
              </p>
            </div>
            <AlertActions
              id={alert.id}
              ticker={alert.symbol.ticker}
              canReset={alert.status === "rang"}
            />
          </div>
        </article>
      ))}
    </div>
  </>
);

export default AlertsList;
