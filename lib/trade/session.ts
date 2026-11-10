import { MARKET_CALENDARS } from "@/lib/market/holidays";
import { MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";

// Minutes after midnight, in market time. "HH:MM" in, number out, and back.
export const toMinutes = (hhmm: string): number => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
};

export const toHHMM = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export type SessionTimes = {
  open: number;
  close: number;
  // The usual close. Differs from `close` on an early-close day.
  normalClose: number;
};

export const getSessionTimes = (
  market: MarketId,
  date: string,
): SessionTimes => {
  const { open, close } = MARKETS[market];
  const early = MARKET_CALENDARS[market].earlyCloses[date];
  return {
    open: toMinutes(open),
    close: toMinutes(early ?? close),
    normalClose: toMinutes(close),
  };
};

// A cutoff at or after an early close moves up by however much the close moved, so
// 30 minutes before a 16:00 close becomes 30 minutes before a 13:00 close.
export const moveForEarlyClose = (
  time: number,
  { open, close, normalClose }: SessionTimes,
): number => {
  if (time < close) return time;
  const moved = time - (normalClose - close);
  return moved > open ? moved : close;
};
