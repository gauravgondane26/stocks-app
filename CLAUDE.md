# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run lint     # ESLint (eslint.config.mjs, next eslint config)
```

No test runner is configured (Phase 7 of the build plan adds one, likely Vitest). There is no typecheck script; use `npx tsc --noEmit`.

## Project status

The app (OpenWatch, renamed from the tutorial's Signalist) started as a YouTube tutorial and is being extended to cover both US and Indian markets, with alerts and trade tools. It is a portfolio piece that a family member who trades also uses, so free and unofficial data sources are acceptable.

`Stocks App Build Plan.md` is the roadmap and holds the task checklists. It is gitignored, so it exists only on the owner's machine and may be missing from other checkouts. Work one phase at a time, finish its "done when" line, and commit before starting the next. Update this file as each phase lands.

Phases, in dependency order: 0 fixes and setup, 1 database and auth, 2 market data layer, 3 search, stock page and watchlist, 4 price alerts, 5 trade tools, 6 news, emails and digest, 7 tests and deploy. The plan's "Parked for later" items (F&O data, ICICI Breeze, an in-app Claude assistant) are out of scope.

Inngest, Nodemailer and Gemini are planned but not in the repo yet. Check `package.json` before assuming a dependency is installed.

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

**Markets and data**

- Features get data only through `getMarketData(market)` in `lib/market/index.ts`, never from Finnhub or Yahoo directly. Results are `{ ok: true, data }` or `{ ok: false, reason }`, so handle failure as a normal case. The free Finnhub key covers US search, profile and news only: Yahoo supplies quotes and bars for both markets, and India search uses `lib/market/data/nse-symbols.json` (refresh it with `node scripts/seed-nse-symbols.mjs`).
- Call data sources with the honest `User-Agent` in `lib/market/http.ts`. Don't add browser disguises or session-cookie tricks to reach an endpoint.
- TradingView embeds refuse NSE symbols, so `toTradingView()` returns the BSE listing for Indian stocks. Yahoo still uses `.NS`, so widget prices can differ slightly from quotes. Check new Indian widget symbols in a browser, because a bad one only shows an error at runtime.
- Yahoo's `chartPreviousClose` can be wrong, so `yahooProvider.quote` works out the previous close from daily bars.
- `getCurrentMarket()` in `lib/market/current.ts` returns the active market (cookie, then sign-up country). Holiday data in `lib/market/holidays.ts` is copied from exchange sites: NSE is only published through 2026, and `hasHolidayData()` turns false once a calendar runs out.
- Market-specific values (hours, holidays, currency, symbol suffixes, session times) come from `lib/market/markets.ts`. Don't hardcode `NASDAQ`, `09:30` or `$` in feature code.
- Store symbols as `{ market, exchange, ticker }` and use the converters (`toTradingView()`, `toYahoo()`) to get each service's format. Format money with `Intl.NumberFormat` for the market's locale and currency.
- US-only rules stay out of India's path, such as the pattern-day-trader guard in the risk check.

**Alerts and background jobs**

- Keep rule evaluation in pure functions (`lib/alerts/evaluate.ts`) with no database or network calls.
- An alert rings once. Update it with a condition on `status: active`, and send the email only if that update changed a document, so overlapping runs can't send twice.
- Digests fan out one event per user, so a failed email doesn't stop the rest.

**Porting and the tutorial**

- Before porting from `Jakeschincariol/day-trader-skill`, read the matching `SKILL.md` and Python script, because the exact thresholds live there. Ported code and copied fixtures keep the MIT notice and a credit comment.
- Don't copy these from the tutorial: its Radix components (it targets Next 15, this repo doesn't use Radix), its `NEXT_PUBLIC_FINNHUB_API_KEY` fallback, its hardcoded sender address, or its `middleware/index.ts`, which would cause a redirect loop if it were active.

**Open questions for the owner**

Ask rather than guess: the Indian flat-by time, and which Indian sectors to offer in the sign-up form.

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
  (auth)/
    layout.tsx        # Two-column auth shell: form on the left, testimonial and preview on the right
    sign-in/, sign-up/
```

The `(root)` route group is for pages that will require a session, and `(auth)` is for the sign-in and sign-up pages. Future routes (`/search`, `/watchlist`) go inside `(root)/`. `/search` is already in `NAV_ITEMS` but has no page yet.

### Components

`components/ui/` holds Base UI primitives styled with CVA — treat them like shadcn components. `NavItems` and `UserDropdown` are `"use client"` because they use `usePathname`/`useRouter`.

`lib/constants.ts` holds `NAV_ITEMS`, the sign-up form options, the TradingView widget configs and `POPULAR_STOCK_SYMBOLS`.

### TradingView widgets

`components/TradingViewWidget.tsx` renders the container and `hooks/useTradingViewWidget.tsx` injects the script. TradingView embeds read their config from the JSON body of the `<script>` tag, so the hook writes the config into `script.innerHTML` and appends the script to the container.

The hook's effect depends on `config` by reference, and it clears and reloads the widget when that reference changes. The dashboard configs are stable module constants. The per-symbol configs in `lib/constants.ts` are functions that return a new object on each call, so memoize their result (or call them outside the render path) to avoid reloading the widget on every re-render.


### Shared types

`types/global.d.ts` declares ambient types in `declare global` (form data, field props, `Stock`), so they are used without imports. `skipLibCheck` is on, so `tsc` doesn't report errors inside this file: `Control`, `FieldError` and the other `react-hook-form` types it references aren't imported, and won't be checked until they are.

### Styling conventions

All reusable utility classes (`.header`, `.yellow-btn`, `.form-input`, etc.) are defined in `globals.css` under `@layer utilities`. Custom brand colors (`gray-900`–`gray-400`, `yellow-400/500`, `teal-400`, `red-500`, etc.) are declared in the `@theme` block. Use these tokens instead of raw hex values.

Dark mode is **always on** — the `.dark` class is hardcoded on `<html>`. The app's background is `bg-gray-900` (#050505).

TradingView widget CSS is already present in `globals.css`. Widget configs in `lib/constants.ts` set a `#141414` background, the one place raw hex is expected, since those values go to TradingView rather than Tailwind.

### Assets

Static assets live in `public/assets/icons/` (SVG) and `public/assets/images/` (PNG). Reference them as `/assets/icons/logo.svg` etc.
