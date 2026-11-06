import type { MarketId } from "@/lib/market/types";

type MarketCalendar = {
  // The last date this data covers. Update the file before it passes.
  knownThrough: string;
  closed: readonly string[];
  // Date mapped to the local closing time on that day.
  earlyCloses: Readonly<Record<string, string>>;
};

export const MARKET_CALENDARS: Record<MarketId, MarketCalendar> = {
  // Source: https://www.nyse.com/trade/hours-calendars, checked 2026-11-06.
  US: {
    knownThrough: "2028-12-31",
    closed: [
      "2026-01-01", // New Year's Day
      "2026-01-19", // Martin Luther King, Jr. Day
      "2026-02-16", // Washington's Birthday
      "2026-04-03", // Good Friday
      "2026-05-25", // Memorial Day
      "2026-06-19", // Juneteenth
      "2026-07-03", // Independence Day (observed)
      "2026-09-07", // Labor Day
      "2026-11-26", // Thanksgiving Day
      "2026-12-25", // Christmas Day
      "2027-01-01", // New Year's Day
      "2027-01-18", // Martin Luther King, Jr. Day
      "2027-02-15", // Washington's Birthday
      "2027-03-26", // Good Friday
      "2027-05-31", // Memorial Day
      "2027-06-18", // Juneteenth (observed)
      "2027-07-05", // Independence Day (observed)
      "2027-09-06", // Labor Day
      "2027-11-25", // Thanksgiving Day
      "2027-12-24", // Christmas Day (observed)
      "2028-01-17", // Martin Luther King, Jr. Day
      "2028-02-21", // Washington's Birthday
      "2028-04-14", // Good Friday
      "2028-05-29", // Memorial Day
      "2028-06-19", // Juneteenth
      "2028-07-04", // Independence Day
      "2028-09-04", // Labor Day
      "2028-11-23", // Thanksgiving Day
      "2028-12-25", // Christmas Day
    ],
    earlyCloses: {
      "2026-11-27": "13:00",
      "2026-12-24": "13:00",
      "2027-11-26": "13:00",
      "2028-07-03": "13:00",
      "2028-11-24": "13:00",
    },
  },
  // Source: NSE equities trading holidays,
  // https://www.nseindia.com/resources/exchange-communication-holidays, checked
  // 2026-11-06. Weekend holidays are left out because weekends are already closed.
  // Muhurat Trading on Sunday 2026-11-08 is not modelled: NSE had not published
  // its timings, so the market reads as closed that day.
  IN: {
    knownThrough: "2026-12-31",
    closed: [
      "2026-01-15", // Municipal Corporation Election - Maharashtra
      "2026-01-26", // Republic Day
      "2026-03-03", // Holi
      "2026-03-26", // Shri Ram Navami
      "2026-03-31", // Shri Mahavir Jayanti
      "2026-04-03", // Good Friday
      "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
      "2026-05-01", // Maharashtra Day
      "2026-05-28", // Bakri Id
      "2026-06-26", // Muharram
      "2026-09-14", // Ganesh Chaturthi
      "2026-10-02", // Mahatma Gandhi Jayanti
      "2026-10-20", // Dussehra
      "2026-11-10", // Diwali-Balipratipada
      "2026-11-24", // Prakash Gurpurb Sri Guru Nanak Dev
      "2026-12-25", // Christmas
    ],
    earlyCloses: {},
  },
};
