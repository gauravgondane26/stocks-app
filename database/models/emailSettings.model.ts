import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import { connectToDatabase } from "@/database/mongoose";

// Which optional emails a user gets. No document means both are on, so accounts
// made before this setting existed keep getting emails. The welcome email isn't
// optional: it goes out at sign-up, before anyone can change this.
export type EmailSettingsDocument = {
  userId: string;
  digest: boolean;
  alerts: boolean;
  updatedAt: Date;
};

const emailSettingsSchema = new Schema<EmailSettingsDocument>(
  {
    userId: { type: String, required: true },
    digest: { type: Boolean, default: true },
    alerts: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

emailSettingsSchema.index({ userId: 1 }, { unique: true });

export const getEmailSettingsModel = async (): Promise<Model<EmailSettingsDocument>> => {
  await connectToDatabase();

  const model =
    (mongoose.models.EmailSettings as Model<EmailSettingsDocument> | undefined) ??
    mongoose.model<EmailSettingsDocument>("EmailSettings", emailSettingsSchema);
  await model.init();
  return model;
};
