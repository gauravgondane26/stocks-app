export const ALERT_TYPES = [
  "above",
  "below",
  "stop",
  "target",
  "pct",
  "time",
  "opening_bell",
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertStatus = "active" | "rang";

export type AlertRule = {
  type: AlertType;
  level: number | null;
  pct: number | null;
  time: string | null;
};

export type AlertQuote = {
  price: number;
  previousClose: number | null;
};

export type MarketClock = {
  isOpen: boolean;
  // "HH:MM" in the market's own time zone.
  time: string;
};

export const isAlertType = (value: unknown): value is AlertType =>
  typeof value === "string" && ALERT_TYPES.includes(value as AlertType);

// Which single value each type needs from the person setting it.
export const alertValueKind = (
  type: AlertType,
): "level" | "pct" | "time" | "none" => {
  if (type === "pct") return "pct";
  if (type === "time") return "time";
  return type === "opening_bell" ? "none" : "level";
};
