# Thinkway Platform — Branding & PWA Deployment Report

**Date:** 2026-07-26  
**Scope:** Browser branding, Progressive Web App installability, install prompt, splash — **no business logic / auth / API / workflow changes**  
**Asset source:** `thinkway-branding.zip` (Thinkway Brand Kit) — logos used as supplied (not redesigned)

---

## Verdict

**READY FOR DEPLOY** — assets, manifest, metadata, service worker, install prompt, and splash are implemented and validated locally (`scripts/validate-pwa-branding.mjs` → `PWA_BRANDING_OK`).

Lighthouse PWA numeric score against Production was **not** obtained in this session (Chrome launcher temp cleanup EPERM; Production has not yet received this code). Re-run Lighthouse on `app.thinkwaymedia.com` after Preview/Production deploy.

---

## 1. Files added

| Path | Purpose |
|---|---|
| `public/favicon.ico` | Multi-size favicon |
| `public/favicon-16x16.png` / `favicon-32x32.png` | Tab icons |
| `public/apple-touch-icon.png` | iOS Home Screen |
| `public/android-chrome-192x192.png` / `512x512.png` | Chrome Android |
| `public/icon-{72,96,128,144,152,192,256,384,512}.png` / `icon-1024.png` | PWA / launcher icons |
| `public/mstile-150x150.png` | Windows tile |
| `public/og-image.png` | Open Graph |
| `public/twitter-card.png` | Twitter/X card |
| `public/splash-1536x2048.png` / `1668x2388` / `2048x2732` | iOS startup images |
| `public/manifest.webmanifest` | PWA manifest (`display: standalone`) |
| `public/browserconfig.xml` | Windows tile config |
| `public/sw.js` | Minimal network-only service worker (installability) |
| `app/favicon.ico` | Next.js App Router favicon convention |
| `components/pwa/pwa-provider.tsx` | SW registration + composition |
| `components/pwa/pwa-install-prompt.tsx` | `beforeinstallprompt` modal |
| `components/pwa/pwa-splash.tsx` | Clears standalone splash overlay |
| `lib/pwa/install-storage.ts` | Dismissal (30 days) / installed flags |
| `lib/pwa/install-storage.test.ts` | Unit tests for persistence |
| `scripts/validate-pwa-branding.mjs` | Asset + manifest integrity check |
| `docs/infrastructure/THINKWAY_PWA_BRANDING_DEPLOYMENT_REPORT_2026-07-26.md` | This report |

---

## 2. Files modified

| Path | Change |
|---|---|
| `app/layout.tsx` | Metadata (title **Thinkway Platform**, icons, OG/Twitter, Apple web app, manifest), viewport `themeColor` `#090B14`, iOS splash links, splash DOM |
| `app/globals.css` | Standalone splash styles (`#090B14`, centred logo) |
| `components/providers/app-providers.tsx` | Wrap with `PwaProvider` |
| `next.config.ts` | CSP `worker-src 'self' blob:` |
| `lib/security/security-headers.ts` | Same `worker-src` for proxy/document CSP |
| `lib/security/security-headers.test.ts` | Assert `worker-src` |

---

## 3. Browser compatibility

| Browser | Favicon / title | Install | Standalone | Notes |
|---|---|---|---|---|
| **Chrome** (Win/macOS/Android) | Yes | `beforeinstallprompt` + Install | Yes | Full PWA path |
| **Edge** | Yes | Same as Chromium | Yes | Full PWA path |
| **Safari** (macOS/iOS) | Yes | Manual **Add to Home Screen**; modal shows Share instructions | Yes (iOS) | No `beforeinstallprompt` |
| **Firefox** | Yes | Menu install / Add to Home Screen where available; modal shows guidance | Partial | No Chromium install event |

---

## 4. Lighthouse PWA score

| Item | Status |
|---|---|
| Automated score this session | **Not measured** (launcher EPERM; code not on Production yet) |
| Expected after deploy | Installable criteria met: HTTPS, manifest (name, 192+512 icons, `standalone`), registered SW with `fetch` handler, `theme_color` / `background_color` |
| Command to run post-deploy | `npx lighthouse https://app.thinkwaymedia.com --only-categories=pwa --view` |

---

## 5. Installability status

| Requirement | Implementation |
|---|---|
| Manifest name | `Thinkway Platform` |
| Short name | `Thinkway` (under-icon label) |
| `display` | `standalone` |
| Theme / background | `#090B14` |
| Icons 192 + 512 | Present (`purpose: any`) |
| Service worker | `/sw.js` registered from `PwaProvider` |
| Install UI | Welcome modal → Install / Maybe Later |
| Success persistence | `localStorage` `thinkway.pwa.installed` — never show again |
| Dismiss | `thinkway.pwa.dismissedAt` — resurface after **30 days** |
| Workflow safety | Modal delayed **2.5s**; does not alter routes/APIs |

---

## 6. Manifest validation

| Check | Result |
|---|---|
| JSON parse | PASS |
| `name` / `display` / colours / `start_url` | PASS |
| Icon paths resolve on disk | PASS |
| Script | `node scripts/validate-pwa-branding.mjs` → **PWA_BRANDING_OK** |

---

## 7. Browser icon validation

All brand-kit files copied to `public/` without modification. Layout metadata references favicon.ico, 16/32 PNGs, Apple Touch 180, PWA 192/512, OG 1200×630, Twitter card. Windows tile via `browserconfig.xml` + `msapplication-*` meta.

---

## 8. Mobile installation validation

| Platform | Method | Status |
|---|---|---|
| Android (Chrome) | Install prompt / browser Install app | Implemented (requires HTTPS deploy) |
| iPhone (Safari) | Share → Add to Home Screen; `apple-touch-icon` + splash images | Implemented |
| Modal iOS help copy | Shown when native prompt unavailable | Implemented |

---

## 9. Desktop installation validation

| Platform | Method | Status |
|---|---|---|
| Windows (Chrome/Edge) | Install → Start Menu / Desktop shortcut, standalone window | Implemented |
| macOS (Chrome/Edge) | Install → Applications-style PWA window | Implemented |
| Safari macOS | Limited; use Dock / Add to Dock where offered | Guidance in modal |

Standalone CSS splash + manifest `background_color` / `theme_color` provide dark branded launch.

---

## 10. Recommendations (future)

1. Run Lighthouse PWA on Production after deploy; capture score in this report.  
2. Optional **maskable** icon variants (safe zone) for Android adaptive icons — do **not** alter the official mark without Brand Kit guidance.  
3. Expand iOS `apple-touch-startup-image` set for more device sizes if needed.  
4. Consider offline shell caching later (current SW is network-only by design — zero behaviour change).  
5. Fix residual BullMQ `{url}` producer issue (unrelated to branding) in a separate change.

---

## Functional regression note (Part 9)

No authentication, dashboard, Discovery, Campaign Studio, Creator Intelligence, worker, routing, or API modules were modified. Changes are limited to metadata, static assets, CSP `worker-src`, and client-side PWA UI wrappers.
