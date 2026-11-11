# OpenWatch

A read-only stock dashboard for the US and Indian (NSE and BSE) markets: search, stock pages with charts, watchlists, price alerts, a chart scanner, day-trading planning tools, and daily news digests by email. It started from a YouTube tutorial (Signalist) and is a personal portfolio project.

OpenWatch never places orders. Prices come from free, unofficial sources and are delayed. Nothing in it is financial advice.

## Running it locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill it in. Every value is server-side only.
3. Start the app: `npm run dev`, then open http://localhost:3000.
4. For background jobs (price alerts, scans, the welcome email and daily digests), set `INNGEST_DEV=1` in `.env.local` and run the Inngest dev server in a second terminal:

   ```bash
   npx inngest-cli@latest dev -u http://localhost:3000/api/inngest --no-discovery
   ```

   Its dashboard at http://localhost:8288 shows the jobs and can trigger them by hand, for example `app/digest.in` for the India digest.

Other commands: `npm run build`, `npm run lint`, and `npx tsc --noEmit` for a typecheck.

## Email

Emails go out through Gmail SMTP using `NODEMAILER_EMAIL` and a Google app password in `NODEMAILER_PASSWORD` (not the account password).

- **Sending limits.** A personal Gmail account can send about 500 messages a day, and Google blocks sending for up to a day once that is passed ([Gmail's limits](https://support.google.com/mail/answer/22839)). Each user gets at most one welcome email, one digest per market per trading day and one email per alert that rings, so this is fine for a handful of users but not for a public app. A larger audience needs a transactional email service.
- **What users get.** A welcome email at sign-up, a daily news digest per market after the close, and price alert emails. The digest and alert emails can be turned off under Settings, and every one of them links there.
- **AI text.** The welcome intro and the digest summary are written by OpenAI (`OPENAI_API_KEY`) and fall back to plain text when the API is unavailable.

## Data sources

Quotes and charts: Yahoo Finance. US search, profiles and news: Finnhub (free key). Indian search: a bundled NSE symbol list. Indian news: Google News RSS. Charts on stock pages: TradingView widgets. All are free and unofficial, so any of them can be slow, delayed or briefly unavailable, and the app shows "data unavailable" when they are.
