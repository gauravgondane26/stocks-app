import "server-only";

import { Schema } from "mongoose";

import { getModel } from "@/database/mongoose";

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

export const getNotificationModel = () => getModel<NotificationDocument>("Notification", notificationSchema);
