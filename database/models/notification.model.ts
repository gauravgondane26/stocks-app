import "server-only";

import mongoose, { Schema, type Model } from "mongoose";

import { connectToDatabase } from "@/database/mongoose";

export type NotificationDocument = {
  userId: string;
  alertId: string;
  message: string;
  createdAt: Date;
};

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: { type: String, required: true },
    alertId: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export const getNotificationModel = async (): Promise<
  Model<NotificationDocument>
> => {
  await connectToDatabase();

  const model =
    (mongoose.models.Notification as
      | Model<NotificationDocument>
      | undefined) ??
    mongoose.model<NotificationDocument>("Notification", notificationSchema);
  await model.init();
  return model;
};
