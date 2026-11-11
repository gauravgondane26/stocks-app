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

const WELCOME_NOTICE =
  "OpenWatch is read-only and never places orders. Prices are delayed and unofficial. Nothing in OpenWatch is financial advice, and most day traders lose money.";

const welcomeFeatures = (marketLabel: string) => [
  ["Watchlist", `follow the ${marketLabel} stocks you care about in one place.`],
  ["Price alerts", "get an email when a stock crosses a level you set."],
  ["Scanner", "see which charts match common setups each trading day."],
  ["Trade plan", "work out entry, stop, size and risk before you trade."],
];

export const welcomeEmailText = ({
  name,
  intro,
  marketLabel,
  appUrl,
}: {
  name: string;
  intro: string;
  marketLabel: string;
  appUrl: string;
}) =>
  `Hi ${name},\n\n${intro}\n\nWhat you can do:\n${welcomeFeatures(marketLabel)
    .map(([title, text]) => `- ${title}: ${text}`)
    .join("\n")}\n\nOpen OpenWatch: ${appUrl}\n\n${WELCOME_NOTICE}\n`;

export const welcomeEmailHtml = ({
  name,
  intro,
  marketLabel,
  appUrl,
}: {
  name: string;
  intro: string;
  marketLabel: string;
  appUrl: string;
}) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
  <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Welcome to OpenWatch</p>
  <h1 style="margin:0 0 16px;font-size:20px;">Hi ${escapeHtml(name)},</h1>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">${escapeHtml(intro)}</p>
  <p style="margin:0 0 8px;font-size:16px;font-weight:bold;">What you can do</p>
  <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.6;">
    ${welcomeFeatures(marketLabel)
      .map(([title, text]) => `<li><strong>${escapeHtml(title)}:</strong> ${escapeHtml(text)}</li>`)
      .join("\n    ")}
  </ul>
  <p style="margin:0 0 24px;"><a href="${escapeHtml(appUrl)}" style="color:#b45309;">Open OpenWatch</a></p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">${WELCOME_NOTICE}</p>
</div>`;

export type DigestHeadline = { headline: string; url: string; source: string; publishedAt: number };
export type DigestStock = { ticker: string; company: string; items: DigestHeadline[] };

export type DigestEmail = {
  name: string;
  marketLabel: string;
  dateLabel: string;
  // Null when the AI summary was unavailable; the headlines still go out.
  summary: string | null;
  stocks: DigestStock[];
  // Watchlist tickers with no new headlines.
  quiet: string[];
  watchlistUrl: string;
  locale: string;
  timeZone: string;
};

const DIGEST_NOTICE =
  "Headlines come from third-party sources and are not checked by OpenWatch. Prices are delayed and unofficial. This email is information only, not financial advice.";

const headlineTime = (publishedAt: number, locale: string, timeZone: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(publishedAt);

export const digestEmailText = (email: DigestEmail) =>
  [
    `Hi ${email.name},`,
    "",
    email.summary ?? `Here are the latest headlines for your ${email.marketLabel} watchlist.`,
    "",
    ...email.stocks.flatMap(({ ticker, company, items }) => [
      `${ticker} - ${company}`,
      ...items.map(
        (item) =>
          `- ${item.headline} (${item.source}, ${headlineTime(item.publishedAt, email.locale, email.timeZone)})\n  ${item.url}`,
      ),
      "",
    ]),
    ...(email.quiet.length ? [`No new headlines: ${email.quiet.join(", ")}`, ""] : []),
    `Your watchlist: ${email.watchlistUrl}`,
    "",
    DIGEST_NOTICE,
    "",
  ].join("\n");

export const digestEmailHtml = (email: DigestEmail) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
  <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">OpenWatch ${escapeHtml(email.marketLabel)} digest, ${escapeHtml(email.dateLabel)}</p>
  <h1 style="margin:0 0 16px;font-size:20px;">Hi ${escapeHtml(email.name)},</h1>
  <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">${escapeHtml(
    email.summary ?? `Here are the latest headlines for your ${email.marketLabel} watchlist.`,
  )}</p>
  ${email.stocks
    .map(
      ({ ticker, company, items }) => `<h2 style="margin:0 0 8px;font-size:16px;">${escapeHtml(ticker)} <span style="font-weight:normal;color:#6b7280;">${escapeHtml(company)}</span></h2>
  <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.5;">
    ${items
      .map(
        (item) =>
          `<li style="margin-bottom:6px;"><a href="${escapeHtml(item.url)}" style="color:#b45309;">${escapeHtml(item.headline)}</a><br><span style="font-size:13px;color:#6b7280;">${escapeHtml(item.source)}, ${escapeHtml(headlineTime(item.publishedAt, email.locale, email.timeZone))}</span></li>`,
      )
      .join("\n    ")}
  </ul>`,
    )
    .join("\n  ")}
  ${
    email.quiet.length
      ? `<p style="margin:0 0 20px;font-size:14px;color:#6b7280;">No new headlines: ${escapeHtml(email.quiet.join(", "))}</p>`
      : ""
  }
  <p style="margin:0 0 24px;"><a href="${escapeHtml(email.watchlistUrl)}" style="color:#b45309;">Open your watchlist</a></p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">${DIGEST_NOTICE}</p>
</div>`;

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
