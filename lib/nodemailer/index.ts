import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { stockPath } from "@/lib/market/symbols";
import type { StockSymbol } from "@/lib/market/types";
import {
  alertEmailHtml,
  alertEmailText,
  digestEmailHtml,
  digestEmailText,
  type DigestEmail,
  welcomeEmailHtml,
  welcomeEmailText,
} from "@/lib/nodemailer/templates";

let transporter: Transporter | undefined;

const getTransporter = (): Transporter | null => {
  const user = process.env.NODEMAILER_EMAIL;
  const pass = process.env.NODEMAILER_PASSWORD;
  if (!user || !pass) return null;

  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
};

const sender = () => `OpenWatch <${process.env.NODEMAILER_EMAIL}>`;

// False when email isn't configured, so a missing setting doesn't fail the alert check.
export const sendAlertEmail = async ({
  to,
  message,
  symbol,
  company,
}: {
  to: string;
  message: string;
  symbol: StockSymbol;
  company: string;
}): Promise<boolean> => {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn("NODEMAILER_EMAIL or NODEMAILER_PASSWORD is not set.");
    return false;
  }

  const stockUrl = `${process.env.BETTER_AUTH_URL}${stockPath(symbol)}`;
  const settingsUrl = `${process.env.BETTER_AUTH_URL}/settings#email`;
  await mailer.sendMail({
    from: sender(),
    to,
    subject: `OpenWatch alert: ${symbol.ticker}`,
    text: alertEmailText({ message, company, stockUrl, settingsUrl }),
    html: alertEmailHtml({ message, company, stockUrl, settingsUrl }),
  });
  return true;
};

// False when email isn't configured. A send failure throws, so the job can retry.
export const sendDigestEmail = async (to: string, email: DigestEmail): Promise<boolean> => {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn("NODEMAILER_EMAIL or NODEMAILER_PASSWORD is not set.");
    return false;
  }

  await mailer.sendMail({
    from: sender(),
    to,
    subject: `Your OpenWatch ${email.marketLabel} digest for ${email.dateLabel}`,
    text: digestEmailText(email),
    html: digestEmailHtml(email),
  });
  return true;
};

// False when email isn't configured. A send failure throws, so the job can retry.
export const sendWelcomeEmail = async ({
  to,
  name,
  intro,
  marketLabel,
}: {
  to: string;
  name: string;
  intro: string;
  marketLabel: string;
}): Promise<boolean> => {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn("NODEMAILER_EMAIL or NODEMAILER_PASSWORD is not set.");
    return false;
  }

  const appUrl = `${process.env.BETTER_AUTH_URL}/`;
  await mailer.sendMail({
    from: sender(),
    to,
    subject: "Welcome to OpenWatch",
    text: welcomeEmailText({ name, intro, marketLabel, appUrl }),
    html: welcomeEmailHtml({ name, intro, marketLabel, appUrl }),
  });
  return true;
};
