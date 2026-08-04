# Prompt Summary — Current Sprint

**Branch:** `develop`  
**Focus:** Product Excellence — Shortlist & Quotation templates (not Release 2.4)

## Shortlist / Quotation export quality — SHIPPED

- Commit: `f33bef57` — workspace selection SSOT (no sessionStorage) · pre-preview summary · Preview chrome · PDF/PPTX layout · 50-creator validation **75/75**
- CI: Validate Run 346 **green** on `f33bef57`
- Dev Preview: `https://dev.thinkwaymedia.com` (develop auto-deploy)
- Production: `dpl_3zTJ1PorFfVVWKXKgb57uD2JxRMs` → `https://app.thinkwaymedia.com` (CLI deploy + alias)
- Live smoke (Liwa SL-2026-0017 / QT-2026-0018): Selection · Preview · PDF · PPTX · counts · totals · no ellipsis/clamp — **PASS**

## Hotfix (local, not shipped) — Quotation PPTX won't open in PowerPoint

- **Symptom:** `Sorry, PowerPoint can't read …-showcase.pptx` (e.g. QT-2026-0013-V2)
- **Cause:** Facebook/YouTube icons were SVG; pptxgenjs embeds SVG bytes as a fake `.png` → corrupt OOXML
- **Fix:** `public/platform-icons/{facebook,youtube}.png` · `report-platform-icons.ts` uses PNG · PPTX skips SVG embeds
- Verified: new icon PPTX opens; surgically patched broken file opens (9 slides). Needs commit → develop → Dev/Prod redeploy

## Prior closed

**Apify Manual Refresh:** CLOSED · Enterprise Ready · Production PASS (`937dd503`)  
**Studio + Creator Detail progressive load:** on `develop`

## Dev infra (separate)

Railway Dev worker crash — `BACKLOG_DEV_RAILWAY_WORKER_REDIS_LOG_RATE_LIMITS.md`
