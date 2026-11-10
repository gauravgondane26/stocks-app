import "server-only";

import { Types } from "mongoose";

import { getAlertModel, type AlertDocument } from "@/database/models/alert.model";
import { getNotificationModel } from "@/database/models/notification.model";
import { connectToDatabase } from "@/database/mongoose";
import { ringMessage } from "@/lib/alerts/describe";
import { shouldRing } from "@/lib/alerts/evaluate";
import type { AlertQuote, MarketClock } from "@/lib/alerts/types";
import { getMarketData } from "@/lib/market";
import { getMarketClock, isMarketOpen } from "@/lib/market/hours";
import { MARKET_IDS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import { sendAlertEmail } from "@/lib/nodemailer";

const QUOTE_BATCH_SIZE = 5;
const QUOTE_BATCH_PAUSE_MS = 500;

export type RingCandidate = {
  alertId: string;
  price: number | null;
  message: string;
};

// One quote per stock, in small batches to go easy on the free data source. A stock
// is left out when its quote failed or is from an earlier day: right after the open
// Yahoo can still report yesterday's price and yesterday's percent move.
const fetchQuotes = async (
  market: MarketId,
  alerts: AlertDocument[],
  today: string,
): Promise<Map<string, AlertQuote>> => {
  const symbols = new Map(
    alerts
      .filter(({ type }) => type !== "time" && type !== "opening_bell")
      .map(({ ticker, exchange }) => [ticker, { market, exchange, ticker }]),
  );
  const pending = [...symbols.values()];
  const quotes = new Map<string, AlertQuote>();

  for (let start = 0; start < pending.length; start += QUOTE_BATCH_SIZE) {
    if (start > 0) {
      await new Promise((resolve) => setTimeout(resolve, QUOTE_BATCH_PAUSE_MS));
    }

    const batch = pending.slice(start, start + QUOTE_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((symbol) => getMarketData(market).quote(symbol)),
    );

    results.forEach((result, index) => {
      if (!result.ok) return;
      const { price, previousClose, asOf } = result.data;
      if (getMarketClock(market, new Date(asOf)).date !== today) return;
      quotes.set(batch[index].ticker, { price, previousClose });
    });
  }

  return quotes;
};

// Only reads, so that a retry can't lose a ring. `ringAlert` does the writing.
export const findRingingAlerts = async (
  now: Date = new Date(),
): Promise<RingCandidate[]> => {
  const candidates: RingCandidate[] = [];

  for (const market of MARKET_IDS) {
    if (!isMarketOpen(market, now)) continue;

    const Alert = await getAlertModel();
    const alerts = await Alert.find({ status: "active", market }).lean();
    if (alerts.length === 0) continue;

    const { date, time } = getMarketClock(market, now);
    const clock: MarketClock = { isOpen: true, time };
    const quotes = await fetchQuotes(market, alerts, date);

    for (const alert of alerts) {
      const quote = quotes.get(alert.ticker) ?? null;
      if (!shouldRing(alert, quote, clock)) continue;

      candidates.push({
        alertId: alert._id.toString(),
        price: quote?.price ?? null,
        message: ringMessage(alert, alert.ticker, market, quote, clock),
      });
    }
  }

  return candidates;
};

// Better Auth's Mongo adapter stores user ids as ObjectIds.
const findUserContact = async (userId: string) => {
  const { connection } = await connectToDatabase();
  return connection.db
    ?.collection("user")
    .findOne(
      { _id: new Types.ObjectId(userId) },
      { projection: { email: 1, name: 1 } },
    );
};

// The update only matches an active alert, so of any overlapping runs exactly one gets
// the document back and notifies. Failures after that are logged and not rethrown:
// a retry couldn't claim the alert again, so the other channel should still go out.
export const ringAlert = async ({
  alertId,
  price,
  message,
}: RingCandidate): Promise<boolean> => {
  const Alert = await getAlertModel();
  const alert = await Alert.findOneAndUpdate(
    { _id: alertId, status: "active" },
    { $set: { status: "rang", rangAt: new Date(), rangPrice: price } },
    { returnDocument: "after" },
  ).lean();
  if (!alert) return false;

  try {
    const Notification = await getNotificationModel();
    await Notification.create({ userId: alert.userId, alertId, message });
  } catch (error) {
    console.error("Save alert notification failed:", error);
  }

  try {
    const user = await findUserContact(alert.userId);
    if (user?.email) {
      await sendAlertEmail({
        to: user.email,
        message,
        symbol: {
          market: alert.market,
          exchange: alert.exchange,
          ticker: alert.ticker,
        },
        company: alert.company,
      });
    } else {
      console.warn("Alert rang for a user with no email address.");
    }
  } catch (error) {
    console.error("Send alert email failed:", error);
  }

  return true;
};
