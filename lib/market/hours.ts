import { MARKET_CALENDARS } from "@/lib/market/holidays";
import { MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

type LocalTime = { date: string; time: string; weekday: string };

// Building a formatter is slow, and the Time Machine converts thousands of bar times.
const formatters = new Map<MarketId, Intl.DateTimeFormat>();

const getFormatter = (market: MarketId) => {
  let formatter = formatters.get(market);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: MARKETS[market].timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    formatters.set(market, formatter);
  }
  return formatter;
};

const getLocalTime = (market: MarketId, at: Date): LocalTime => {
  const parts = getFormatter(market).formatToParts(at);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
    weekday: part("weekday"),
  };
};

export const getMarketClock = (market: MarketId, at: Date = new Date()) => {
  const { date, time } = getLocalTime(market, at);
  return { date, time };
};

export const isTradingDay = (market: MarketId, at: Date = new Date()) => {
  const { date, weekday } = getLocalTime(market, at);
  if (weekday === "Sat" || weekday === "Sun") return false;
  return !MARKET_CALENDARS[market].closed.includes(date);
};

// Regular session only. The close is exclusive, so 16:00 in New York is closed.
export const isMarketOpen = (market: MarketId, at: Date = new Date()) => {
  if (!isTradingDay(market, at)) return false;

  const { date, time } = getLocalTime(market, at);
  const close =
    MARKET_CALENDARS[market].earlyCloses[date] ?? MARKETS[market].close;

  // "HH:MM" strings compare correctly as text.
  return time >= MARKETS[market].open && time < close;
};

// False once the date passes the published calendar, when isMarketOpen can no
// longer see holidays.
export const hasHolidayData = (market: MarketId, at: Date = new Date()) =>
  getLocalTime(market, at).date <= MARKET_CALENDARS[market].knownThrough;
