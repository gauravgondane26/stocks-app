# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run lint     # ESLint (eslint.config.mjs, next eslint config)
```

No test runner is configured.

## Stack

- **Next.js 16.2.6** with App Router — read `node_modules/next/dist/docs/01-app/` before touching routing or data-fetching APIs
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
```

The `(root)` route group wraps all authenticated pages. Future routes (`/search`, `/watchlist`) go inside `(root)/`.

### Components

`components/ui/` holds Base UI primitives styled with CVA — treat them like shadcn components. `NavItems` and `UserDropdown` are `"use client"` because they use `usePathname`/`useRouter`.

`lib/constants.ts` holds `NAV_ITEMS`; add new nav entries there.

### Styling conventions

All reusable utility classes (`.header`, `.yellow-btn`, `.form-input`, etc.) are defined in `globals.css` under `@layer utilities`. Custom brand colors (`gray-900`–`gray-400`, `yellow-400/500`, `teal-400`, `red-500`, etc.) are declared in the `@theme` block. Use these tokens instead of raw hex values.

Dark mode is **always on** — the `.dark` class is hardcoded on `<html>`. The app's background is `bg-gray-900` (#050505).

TradingView widget CSS is already present in `globals.css`; widget components embed iframes against `#141414` background.

### Assets

Static assets live in `public/assets/icons/` (SVG) and `public/assets/images/` (PNG). Reference them as `/assets/icons/logo.svg` etc.
