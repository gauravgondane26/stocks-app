import "server-only";

import { getEmailSettingsModel } from "@/database/models/emailSettings.model";

export type EmailSettings = { digest: boolean; alerts: boolean };
export type EmailKind = keyof EmailSettings;

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = { digest: true, alerts: true };

// These take a user id, so they live outside "use server" files: actions read the
// id from the session and call them.

export const readEmailSettings = async (userId: string): Promise<EmailSettings> => {
  const Settings = await getEmailSettingsModel();
  const saved = await Settings.findOne({ userId }).lean();
  return saved ? { digest: saved.digest, alerts: saved.alerts } : DEFAULT_EMAIL_SETTINGS;
};

export const writeEmailSettings = async (userId: string, settings: EmailSettings) => {
  const Settings = await getEmailSettingsModel();
  await Settings.updateOne(
    { userId },
    { $set: { ...settings, updatedAt: new Date() } },
    { upsert: true },
  );
};

// For background jobs. If the setting can't be read, the email still goes out:
// a database hiccup shouldn't silently drop an alert someone set.
export const wantsEmail = async (userId: string, kind: EmailKind): Promise<boolean> => {
  try {
    return (await readEmailSettings(userId))[kind];
  } catch (error) {
    console.error("Read email settings failed:", error);
    return true;
  }
};

// The users in `userIds` who turned the digest off, in one query.
export const usersWithDigestOff = async (userIds: string[]): Promise<Set<string>> => {
  if (userIds.length === 0) return new Set();
  const Settings = await getEmailSettingsModel();
  const rows = await Settings.find({ userId: { $in: userIds }, digest: false })
    .select({ userId: 1 })
    .lean();
  return new Set(rows.map(({ userId }) => userId));
};
