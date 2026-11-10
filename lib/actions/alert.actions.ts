"use server";

import { revalidatePath } from "next/cache";

import { getAlertModel } from "@/database/models/alert.model";
import { getCurrentUser, requireUser } from "@/lib/better-auth/session";
import { isMarketId } from "@/lib/market/markets";
import { isValidAlertId, validateAlert } from "@/lib/validation/alerts";

const GENERIC_ERROR = "Couldn't update your alerts. Please try again.";
const SIGNED_OUT_ERROR = "Please sign in again.";
const NOT_FOUND_ERROR = "That alert no longer exists.";
// Every active alert's stock is quoted each check, so this protects the free data source.
const MAX_ACTIVE_ALERTS = 50;

export const createAlert = async (
  input: unknown,
): Promise<AlertActionResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT_ERROR };

  const result = validateAlert(input);
  if (!result.valid) return { ok: false, error: result.error };

  try {
    const Alert = await getAlertModel();
    const active = await Alert.countDocuments({
      userId: user.id,
      status: "active",
    });
    if (active >= MAX_ACTIVE_ALERTS) {
      return {
        ok: false,
        error: `You can have up to ${MAX_ACTIVE_ALERTS} active alerts.`,
      };
    }

    await Alert.create({ ...result.data, userId: user.id });
  } catch (error) {
    console.error("Create alert failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/watchlist");
  return { ok: true };
};

export const getAlerts = async (market: unknown): Promise<AlertsReadResult> => {
  const user = await requireUser();
  if (!isMarketId(market)) return { ok: false };

  try {
    const Alert = await getAlertModel();
    const documents = await Alert.find({ userId: user.id, market })
      .sort({ status: 1, createdAt: -1 })
      .lean();

    return {
      ok: true,
      data: documents.map((alert) => ({
        id: alert._id.toString(),
        symbol: {
          market: alert.market,
          exchange: alert.exchange,
          ticker: alert.ticker,
        },
        company: alert.company,
        type: alert.type,
        level: alert.level,
        pct: alert.pct,
        time: alert.time,
        label: alert.label,
        status: alert.status,
        rangAt: alert.rangAt?.getTime() ?? null,
        rangPrice: alert.rangPrice,
      })),
    };
  } catch (error) {
    console.error("Load alerts failed:", error);
    return { ok: false };
  }
};

export const deleteAlert = async (id: unknown): Promise<AlertActionResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT_ERROR };
  if (!isValidAlertId(id)) return { ok: false, error: NOT_FOUND_ERROR };

  try {
    const Alert = await getAlertModel();
    await Alert.deleteOne({ _id: id, userId: user.id });
  } catch (error) {
    console.error("Delete alert failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/watchlist");
  return { ok: true };
};

// Re-arms an alert that has rung so it can ring once more.
export const resetAlert = async (id: unknown): Promise<AlertActionResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT_ERROR };
  if (!isValidAlertId(id)) return { ok: false, error: NOT_FOUND_ERROR };

  try {
    const Alert = await getAlertModel();
    await Alert.updateOne(
      { _id: id, userId: user.id, status: "rang" },
      { $set: { status: "active", rangAt: null, rangPrice: null } },
    );
  } catch (error) {
    console.error("Reset alert failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/watchlist");
  return { ok: true };
};
