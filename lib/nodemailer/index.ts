import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { stockPath } from "@/lib/market/symbols";
import type { StockSymbol } from "@/lib/market/types";
import { alertEmailHtml, alertEmailText } from "@/lib/nodemailer/templates";

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
  await mailer.sendMail({
    from: `OpenWatch <${process.env.NODEMAILER_EMAIL}>`,
    to,
    subject: `OpenWatch alert: ${symbol.ticker}`,
    text: alertEmailText({ message, company, stockUrl }),
    html: alertEmailHtml({ message, company, stockUrl }),
  });
  return true;
};
