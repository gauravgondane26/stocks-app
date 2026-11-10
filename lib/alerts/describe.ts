import { percentMove } from "@/lib/alerts/evaluate";
import type {
  AlertQuote,
  AlertRule,
  MarketClock,
} from "@/lib/alerts/types";
import { formatMoney, formatPercent } from "@/lib/market/format";
import { MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

const LEVEL_WORDS = {
  above: "at or above your alert level",
  below: "at or below your alert level",
  target: "at or above your target",
  stop: "at or below your stop",
} as const;

// The rule itself, for the alerts list and the confirmation after setting one.
export const describeAlert = (alert: AlertRule, market: MarketId): string => {
  switch (alert.type) {
    case "above":
      return `Price at or above ${formatMoney(alert.level ?? 0, market)}`;
    case "below":
      return `Price at or below ${formatMoney(alert.level ?? 0, market)}`;
    case "stop":
      return `Stop at ${formatMoney(alert.level ?? 0, market)}`;
    case "target":
      return `Target at ${formatMoney(alert.level ?? 0, market)}`;
    case "pct":
      return `Moves ${alert.pct}% from the previous close`;
    case "time":
      return `At ${alert.time} ${MARKETS[market].label} market time`;
    case "opening_bell":
      return "When the market opens";
  }
};

// What happened, stated as a fact. An alert is information, never an order.
export const ringMessage = (
  alert: AlertRule & { label?: string | null },
  ticker: string,
  market: MarketId,
  quote: AlertQuote | null,
  clock: MarketClock,
): string => {
  const note = alert.label ? ` (${alert.label})` : "";

  if (alert.type === "opening_bell") {
    return `Opening bell: the ${MARKETS[market].label} market is open (${clock.time})${note}.`;
  }
  if (alert.type === "time") {
    return `${ticker}: it is ${clock.time} ${MARKETS[market].label} market time (set for ${alert.time})${note}.`;
  }

  const price = formatMoney(quote?.price ?? 0, market);
  if (alert.type === "pct") {
    const move = quote ? percentMove(quote) : null;
    const from = formatMoney(quote?.previousClose ?? 0, market);
    return `${ticker} moved ${formatPercent(move ?? 0)} to ${price} (from ${from})${note}.`;
  }

  const level = formatMoney(alert.level ?? 0, market);
  return `${ticker} is ${price}: ${LEVEL_WORDS[alert.type]} ${level}${note}.`;
};
