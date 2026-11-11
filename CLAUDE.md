# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev        # start dev server (localhost:3000)
npm run build      # production build (needs no secrets)
npm run lint       # ESLint (eslint.config.mjs, next eslint config)
npm test           # Vitest, once; npm run test:watch to rerun on save
npm run typecheck  # tsc --noEmit
```

CI (`.github/workflows/ci.yml`) runs lint, test, build, then typecheck on pull requests and pushes to `main`, on Node 26 (what the Vercel project runs).

## Tests

Tests live in `tests/*.test.ts` and cover pure code. `vitest.config.mts` maps `@/` to the repo root and aliases `server-only` to its empty build, so server modules import cleanly. Trade tool tests use the day-trader skill's fixtures in `tests/fixtures/skill` (MIT notice in its `LICENSE`); `tests/helpers/yahoo.ts` turns them into bars and close series. The Time Machine's history replay must match the Python run exactly, and its simulated odds within a tolerance. AI calls are tested by stubbing `fetch`, and server actions by mocking `next/headers`, `next/navigation` and `getAuth` (see `tests/auth-actions.test.ts`). Never call real APIs or the database from a test.

## Project status

The app (OpenWatch, renamed from the tutorial's Signalist) started as a YouTube tutorial and is being extended to cover both US and Indian markets, with alerts and trade tools. It is a portfolio piece that a family member who trades also uses, so free and unofficial data sources are acceptable.

`Stocks App Build Plan.md` is the roadmap and holds the task checklists. It is gitignored, so it exists only on the owner's machine and may be missing from other checkouts. Work one phase at a time, finish its "done when" line, and commit before starting the next. Update this file as each phase lands.

Production runs at https://openwatch-phi.vercel.app (Vercel project `openwatch`, functions in `bom1` next to the Mumbai Atlas cluster, set in `vercel.json`). It shares the `openwatch` Atlas database with local development. Inngest Cloud reaches it through the Vercel integration, and the GitHub repo is connected, so merges to `main` deploy to production. `INNGEST_SERVE_ORIGIN` in Vercel makes the integration sync the public domain, because deployment URLs sit behind Vercel's deployment protection; `curl -X PUT https://openwatch-phi.vercel.app/api/inngest` resyncs by hand.

Phases, in dependency order: 0 fixes and setup, 1 database and auth, 2 market data layer, 3 search, stock page and watchlist, 4 price alerts, 5 trade tools, 6 news, emails and digest, 7 tests and deploy. The plan's "Parked for later" items (F&O data, ICICI Breeze, an in-app Claude assistant) are out of scope.

Inngest and Nodemailer are installed. Phase 6 uses OpenAI (`OPENAI_API_KEY`) for the welcome email intro and digest summaries, in place of the tutorial's Gemini. There is no SDK: every AI call goes through `generateText` in `lib/ai/index.ts`, which tries `gpt-5-nano` (cheapest, but deprecated by OpenAI) and then `gpt-6-luna`, each at its lowest reasoning effort, and returns a failure instead of throwing so callers fall back to plain text. Pass an `accept` check for anything the text must not say (the welcome intro rejects real-time or live price claims), because a rejected answer goes to the next model. Check `package.json` before assuming a dependency is installed.

## Rules for new code

These come from the build plan. Older code such as the widget configs in `lib/constants.ts` predates some of them.

**Safety**

- The app is read-only. Never add code that places orders or stores broker credentials.
- Trade tools are decision support that end in a plan on screen. Each panel carries a short "not financial advice, simulation not prediction, most day traders lose money" notice.
- Free market data is delayed and unofficial. Show "delayed" wherever prices appear, and handle "data unavailable".

**Server code**

- Keep API keys server-side. Never add a `NEXT_PUBLIC_` variable for a data or AI key. Modules that read a key start with `import 'server-only'`.
- Server actions read the user id from the session and validate their input. Rate-limit the expensive ones (Time Machine, scanner, search).
- Protect routes through `lib/better-auth/session.ts`: `getCurrentUser()` returns the user or null, and `requireUser()` redirects to `/sign-in`. `(root)/layout.tsx` calls `requireUser()`, and `(auth)/layout.tsx` redirects to `/` when there is a session. Layouts don't re-render on client-side navigation, so every protected page must also call `requireUser()` itself. Auth runs through server actions that call `auth.api` directly, so no `/api/auth` route is needed. There is deliberately no `proxy.ts` (Next 16's replacement for `middleware`); before adding one, read `node_modules/next/dist/docs/01-app/02-guides/authentication.md`.
- Better Auth's Mongo adapter does not create indexes for its fields, so `ensureAuthIndexes` in `lib/better-auth/auth.ts` does. Add to it if a new auth field needs one.
- Get the auth instance with `await getAuth()` from `lib/better-auth/auth.ts`, and the database with `connectToDatabase()` from `database/mongoose.ts`. Both connect on first use, so `next build` never needs a database. Secrets live in `.env.local` (see `.env.example`).
- `bufferCommands` is off, so Mongoose models are compiled after connecting, behind an async getter such as `getWatchlistModel()` in `database/models/watchlist.model.ts`. It also awaits `model.init()` so unique indexes exist before the first write.
- Functions that take a user id, like those in `lib/watchlist.ts`, must never be exported from a `"use server"` file, because any client could call them with someone else's id. Actions get the id from the session and call them.
- `allowRequest` in `lib/rate-limit.ts` is a per-instance, in-memory limit. It stops runaway clients but isn't an exact quota on serverless hosting.
- Better Auth's own rate limiter only covers its HTTP handler, not `auth.api` calls, so `signInWithEmail` and `signUpWithEmail` limit themselves (sign-in per email and per IP, sign-up per IP). `clientIp()` reads the headers Vercel sets.
- Vercel Hobby allows functions 300 s with Fluid compute. Long work sets `export const maxDuration = 300`: the Inngest route (the scheduled scan is one step) and the `/scanner` page (its "Run now" server action). A server action takes the limit of the page it runs on.

**Markets and data**

- Features get data only through `getMarketData(market)` in `lib/market/index.ts`, never from Finnhub or Yahoo directly. Results are `{ ok: true, data }` or `{ ok: false, reason }`, so handle failure as a normal case. The free Finnhub key covers US search, profile and news only: Yahoo supplies quotes and bars for both markets, and India search uses `lib/market/data/nse-symbols.json` (refresh it with `node scripts/seed-nse-symbols.mjs`).
- News: US from Finnhub, India from Google News RSS search by company name (`lib/market/providers/google-news.ts`), because Yahoo's per-ticker feed returned nothing for RELIANCE, HDFCBANK and ITC. Pass the company name to `news(symbol, company)` when you have it. Both providers run `filterNews` in `lib/market/news.ts`, which keeps only the last 7 days of headlines that name the company and drops quote pages, price predictions, social posts and duplicates. About half of Finnhub's raw items are about other companies.
- Call data sources with the honest `User-Agent` in `lib/market/http.ts`. Don't add browser disguises or session-cookie tricks to reach an endpoint.
- TradingView embeds refuse NSE symbols, so `toTradingView()` returns the BSE listing for Indian stocks. Yahoo still uses `.NS`, so widget prices can differ slightly from quotes. It also rewrites `&` and `-` as `_`, TradingView's spelling (`M_M`, `BAJAJ_AUTO`). Check new Indian widget symbols in a browser, because a bad one only shows an error at runtime. `getChartListing()` in `lib/market/charts.ts` hides the widgets when a stock has no BSE listing.
- Free sources have no Indian market cap or P/E, so those fields are null and show a dash.
- Yahoo's NSE 5-minute bars at 15:20 are empty every day, 15:25 on most days and 15:15 sometimes. Anything that needs complete Indian sessions must stop before then. The Time Machine (`lib/trade/timemachine.ts`) replays only to the flat-by time (15:15 for India) and only needs past sessions complete up to it.
- For many stocks at once, use `closeSeries` (Yahoo's spark endpoint, 20 symbols a request) rather than one `bars` call per stock. The scanner (`lib/scanner.ts`) scans the index in `lib/market/data/index-members.json` (refresh it with `node scripts/seed-index-members.mjs`) plus watchlists. `toYahoo()` writes US share classes with a dash (BRK.B is BRK-B).
- Spark drops single 5-minute bars at random, even for busy stocks (86 of 503 S&P stocks on 2026-11-10), while the chart endpoint (`bars`) has them. The breakout scan sends these gapped stocks to the full-chart check, but only in the room the clean candidates leave under the 200 cap, so clean results still match the skill.
- Trade tools in `lib/trade/` are pure ports of the day-trader skill (MIT notice in `lib/trade/LICENSE`). The Time Machine's seeded generator differs from the original's Python one, so its odds match the original within a tolerance; the history replay matches exactly.
- Yahoo's `chartPreviousClose` can be wrong, so `yahooProvider.quote` works out the previous close from daily bars.
- `getCurrentMarket()` in `lib/market/current.ts` returns the active market (cookie, then sign-up country). Holiday data in `lib/market/holidays.ts` is copied from exchange sites: NSE is only published through 2026, and `hasHolidayData()` turns false once a calendar runs out.
- Market-specific values (hours, holidays, currency, symbol suffixes, session times) come from `lib/market/markets.ts`. Don't hardcode `NASDAQ`, `09:30` or `$` in feature code.
- Store symbols as `{ market, exchange, ticker }` and use the converters (`toTradingView()`, `toYahoo()`) to get each service's format. Format money with `Intl.NumberFormat` for the market's locale and currency.
- US-only rules stay out of India's path, such as the pattern-day-trader guard in the risk check.

**Alerts and background jobs**

- Keep rule evaluation in pure functions (`lib/alerts/evaluate.ts`) with no database or network calls.
- An alert rings once. Update it with a condition on `status: active`, and send the email only if that update changed a document, so overlapping runs can't send twice.
- Digests fan out one event per user, so a failed email doesn't stop the rest. The daily digest (`lib/digest.ts`, Inngest `digest-us`/`digest-in` at each market's `digestTime`, then `send-digest` per user) skips non-trading days, covers news since the previous trading day's digest, and sends nothing when no stock has new headlines. The fan-out event id is `digest-<market>-<date>-<userId>`, so re-running a market's digest on the same day emails nobody twice; to re-send while testing, send `app/digest.user` yourself without an id.
- Digest and alert emails are optional: `wantsEmail(userId, kind)` in `lib/email-settings.ts` reads the user's choice (no saved document means on, and a read failure also means on, so an alert isn't silently dropped). The welcome email always goes out. Every optional email links to `/settings#email`. A new kind of optional email needs a field in `EmailSettings`, a switch in `components/EmailSettingsForm.tsx`, a `wantsEmail` check in the job and the opt-out line from `lib/nodemailer/templates.ts`.
- Jobs load a user's name and email inside the step that sends, through `findUserFields` in `lib/users.ts`, so contact details never land in saved step results. That helper takes any user id, so keep it out of anything a server action can reach.

**Porting and the tutorial**

- Before porting from `Jakeschincariol/day-trader-skill`, read the matching `SKILL.md` and Python script, because the exact thresholds live there. Ported code and copied fixtures keep the MIT notice and a credit comment.
- Don't copy these from the tutorial: its Radix components (it targets Next 15, this repo doesn't use Radix), its `NEXT_PUBLIC_FINNHUB_API_KEY` fallback, its hardcoded sender address, or its `middleware/index.ts`, which would cause a redirect loop if it were active.

**Open questions for the owner**

None open. Settled: the Indian flat-by time is 15:15 (`MARKETS.IN.tradeDefaults`). Sign-up industries are per market in `PREFERRED_INDUSTRIES` (India follows NSE's sectoral indices), and the investment goals, now including "Active trading", are shared by both markets.

## Stack

- **Next.js 16.4.5** with App Router — read `node_modules/next/dist/docs/01-app/` before touching routing or data-fetching APIs
- **React 19** — use `use client` only when hooks or browser APIs are needed
- **Tailwind CSS v4** — config lives entirely in `globals.css` via `@theme`/`@layer`, not `tailwind.config.*`
- **Base UI** (`@base-ui/react`) as the headless primitive layer — `components/ui/` wraps these with CVA variants (NOT Radix UI)
- **shadcn CLI** for scaffolding additional components (`npx shadcn add …`)
- TypeScript strict mode; path alias `@/` maps to the repo root

## Architecture

### Route layout

```
app/
  layout.tsx          # Root: sets Geist fonts, forces dark mode (.dark on <html>)
  globals.css         # All Tailwind theme + custom utility classes live here
  (root)/
    layout.tsx        # Main shell: renders <Header /> + <div className="container">
    page.tsx          # Dashboard (/)
    stocks/[market]/[ticker]/page.tsx  # Stock page, link to it with stockPath()
    watchlist/page.tsx                 # Watchlist for the active market
  (auth)/
    layout.tsx        # Two-column auth shell: form on the left, testimonial and preview on the right
    sign-in/, sign-up/
```

The `(root)` route group is for pages that will require a session, and `(auth)` is for the sign-in and sign-up pages. Future protected routes go inside `(root)/`. `/search` in `NAV_ITEMS` is not a page: `NavItems` renders it as a button that opens the search dialog.

### Components

`components/ui/` holds Base UI primitives styled with CVA — treat them like shadcn components. `NavItems` and `UserDropdown` are `"use client"` because they use `usePathname`/`useRouter`.

`SearchCommand` is mounted once, in `Header`. Open it from anywhere with `openSearch()` in `lib/search-events.ts`, not with a second instance: a dialog inside the mobile menu would unmount when the menu closes.

`npx shadcn add` currently writes `import { cn } from "cn"` and installs an unrelated `cn` package. Remove the package and point new components at `@/lib/utils`. It also prompts to overwrite `button.tsx` and `input.tsx`, which should stay as they are.

`lib/constants.ts` holds `NAV_ITEMS`, the sign-up form options and the TradingView widget configs. Popular stocks for the empty search box are in `lib/market/popular.ts`.

### TradingView widgets

`components/TradingViewWidget.tsx` renders the container and `hooks/useTradingViewWidget.tsx` injects the script. TradingView embeds read their config from the JSON body of the `<script>` tag, so the hook writes the config into `script.innerHTML` and appends the script to the container.

The hook's effect depends on `config` by reference, and it clears and reloads the widget when that reference changes. The dashboard configs are stable module constants. The per-symbol configs in `lib/constants.ts` are functions that return a new object on each call, so memoize their result (or call them outside the render path) to avoid reloading the widget on every re-render. `components/StockWidgets.tsx` memoizes on the symbol string, because configs built on the server would be new objects after every `revalidatePath`.


### Shared types

`types/global.d.ts` declares ambient types in `declare global` (form data, field props, `SearchStock`, `WatchlistEntry`), so they are used without imports. `skipLibCheck` is on, so `tsc` doesn't report errors inside this file: `Control`, `FieldError` and the other `react-hook-form` types it references aren't imported, and won't be checked until they are.

### Styling conventions

All reusable utility classes (`.header`, `.yellow-btn`, `.form-input`, etc.) are defined in `globals.css` under `@layer utilities`. Custom brand colors (`gray-900`–`gray-400`, `yellow-400/500`, `teal-400`, `red-500`, etc.) are declared in the `@theme` block. Use these tokens instead of raw hex values.

Dark mode is **always on** — the `.dark` class is hardcoded on `<html>`. The app's background is `bg-gray-900` (#050505).

TradingView widget CSS is already present in `globals.css`. Widget configs in `lib/constants.ts` set a `#141414` background, the one place raw hex is expected, since those values go to TradingView rather than Tailwind.

### Assets

Static assets live in `public/assets/icons/` (SVG) and `public/assets/images/` (PNG). Reference them as `/assets/icons/logo.svg` etc.
