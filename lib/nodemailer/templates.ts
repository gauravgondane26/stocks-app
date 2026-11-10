const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const NOTICE =
  "Prices are delayed and unofficial, so this alert may be up to about 15 minutes late. An alert is information only, not an order or financial advice.";

export const alertEmailText = ({
  message,
  company,
  stockUrl,
}: {
  message: string;
  company: string;
  stockUrl: string;
}) => `${company}\n\n${message}\n\n${stockUrl}\n\n${NOTICE}\n`;

export const alertEmailHtml = ({
  message,
  company,
  stockUrl,
}: {
  message: string;
  company: string;
  stockUrl: string;
}) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
  <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">OpenWatch price alert</p>
  <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(company)}</h1>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">${escapeHtml(message)}</p>
  <p style="margin:0 0 24px;"><a href="${escapeHtml(stockUrl)}" style="color:#b45309;">View this stock</a></p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">${NOTICE}</p>
</div>`;
