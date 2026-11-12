import { holidayDataEnd } from "@/lib/market/hours";
import { MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

// Past the last date in lib/market/holidays.ts, a holiday looks like a trading day,
// so say so until the next year's dates are added.
const HolidayDataNotice = ({ market }: { market: MarketId }) => {
  const end = holidayDataEnd(market);
  if (!end) return null;

  const { label, locale } = MARKETS[market];
  // Noon UTC keeps the calendar date the same in any time zone.
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${end}T12:00:00Z`));

  return (
    <div role="status" className="border-b border-gray-600 bg-gray-800">
      <p className="container py-2 text-sm text-yellow-500">
        OpenWatch only has {label} market holidays up to {date}. Until the new dates
        are added, it may treat a holiday as a trading day, so alerts, scans and
        digests can run while the market is closed.
      </p>
    </div>
  );
};

export default HolidayDataNotice;
