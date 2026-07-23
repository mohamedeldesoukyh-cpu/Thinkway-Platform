# Phase 4 — CSS Architecture & Render-Blocking Reduction

**Date:** 2026-07-21  
**Scope:** CSS split only — no Discovery SQL, Avatar APIs, AI workflows, auth, DB, or business logic changes.

## Problem

Production builds shipped a single dominant CSS asset (~**515 KB**) driven by `app/globals.css` importing:

- Tailwind + tokens + dropdown
- **Entire** `thinkway-platform-v6.css` (~145 KB source)
- **Entire** campaign workspace design system (~77 KB, embedded in globals)
- Login illustration/page CSS (~16 KB)
- Plus Tailwind-expanded utilities

Login and portals paid for dashboard/campaign chrome they never use.

## Fix

| Stylesheet | Load site |
|------------|-----------|
| `globals.css` + tokens + dropdown + `chrome-logo.css` | Root (`app/layout.tsx`) — all routes |
| `thinkway-platform-v6.css` | `(dashboard)/layout.tsx` only |
| `campaign-workspace.css` | `(dashboard)/layout.tsx` (+ nested campaigns/discovery/ios for clarity) |
| `login-v2.css` | `login/layout.tsx` only |
| `quotation-redesign.css` | Discovery quotations layout (unchanged) |
| Studio / AI / Outputs / Copilot CSS | Feature component imports (unchanged) |

Shared logo + page loader + navigation overlay remain global via `app/styles/chrome-logo.css`.

## Source CSS sizes (before → after)

| Bundle | Before (in global import graph) | After |
|--------|--------------------------------:|------:|
| Root global chain (globals+tokens+dropdown[+chrome]) | ~**261 KB** source (globals 105 + v6 145 + dropdown 11) | **~28 KB** |
| Dashboard-scoped (v6 + campaign) | (in globals) | **~222 KB** (dashboard only) |
| Login-scoped | (in globals) | **~16 KB** (login only) |
| Largest *built* CSS chunk | **514.9 KB** | **328.8 KB** (−**36%**) |
| Built CSS file count | 5 | 9 (split) |
| Total built CSS (all routes catalog) | ~624 KB | ~623.5 KB |

## Route CSS dependency (required)

| Route family | Root globals | platform-v6 | campaign-workspace | login-v2 | Feature CSS |
|--------------|:---:|:---:|:---:|:---:|---|
| Login | ✓ | | | ✓ | |
| Portals | ✓ | | | | portal shell Tailwind |
| Dashboard home / lists | ✓ | ✓ | ✓ | | |
| Campaigns / IO / Discovery / Quotations | ✓ | ✓ | ✓ | | quotation-redesign on quotations |
| AI / Studio | ✓ | ✓ | ✓ | | studio-chat, campaign-studio-ref, ai-workspace, copilot |
| Outputs (via AI) | ✓ | ✓ | ✓ | | outputs-center-ref |
| Planning / Reports | ✓ | ✓ | ✓ | | |

Campaign Studio / AI / Outputs feature CSS were already component-scoped; Phase 4 did not relocate them.

## Tailwind

- Tailwind v4 via `@tailwindcss/postcss` (no classic `content`/`safelist` config file).
- No safelist bloat found.
- Further utility purge wins require analyzing unused class strings across TSX (Phase 5 candidate) — not attempted here to avoid visual risk.

## Measurements

```bash
$env:SKIP_TYPECHECK="true"; npm run build
npm run measure:css-bundle
```

**FP / LCP / style recalc:** not re-run in browser this phase; expect largest CSS parse drop proportional to **515 → 329 KB** on first document CSS for routes that previously paid the monolith (especially `/login` and portals, which no longer download v6 + campaign).

## Remaining debt

1. `platform-v6` + `campaign-workspace` still load for **all** dashboard routes (operational tables share campaign classes). Further split requires extracting a thin “operational table” layer vs full campaign chrome.
2. Tailwind expanded utilities still dominate remaining ~329 KB chunk.
3. Duplicate logo/loader rules exist in `login-v2.css` and `chrome-logo.css` (harmless; login file retains full page art).
4. Browser visual QA recommended on: login, dashboard home, campaign workspace, quotation, discovery search, IO list.

## Success criteria

- UI classes unchanged (CSS moved, not rewritten).
- No business/API/SQL changes.
- Largest CSS chunk −36%; root global source chain −~90%.
