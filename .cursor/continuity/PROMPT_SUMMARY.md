# Prompt Summary — Current Sprint

**Branch:** `develop`  
**Focus:** Product Excellence — Shortlist & Quotation templates (not Release 2.4)

## Shortlist / Quotation export quality — SHIPPED

- Commit: `f33bef57` — workspace selection SSOT (no sessionStorage) · pre-preview summary · Preview chrome · PDF/PPTX layout · 50-creator validation **75/75**
- CI: Validate Run 346 **green** on `f33bef57`
- Dev Preview: `https://dev.thinkwaymedia.com` (develop auto-deploy)
- Production: `dpl_3zTJ1PorFfVVWKXKgb57uD2JxRMs` → `https://app.thinkwaymedia.com` (CLI deploy + alias)
- Live smoke (Liwa SL-2026-0017 / QT-2026-0018): Selection · Preview · PDF · PPTX · counts · totals · no ellipsis/clamp — **PASS**

## Hotfix — Quotation PPTX won't open in PowerPoint — SHIPPED

- **Cause:** Facebook/YouTube SVG icons → pptxgenjs fake `.png` → PowerPoint "can't read"
- **Fix commit:** `b95b72fd` — PNG icons + SVG guard in quotation PPTX
- Dev: `dpl_k17MppXEuuwK7pxVb5T6p28Y4AGH` → https://dev.thinkwaymedia.com
- Prod: `dpl_AQ8e6AzRv5E81fJwiimjXibARDqZ` → https://app.thinkwaymedia.com
- Smoke: local showcase with FB/YT — `svg_count=0`, PowerPoint **OPENED slides=6**
- Re-export any previously downloaded showcase PPTX (old Downloads files stay broken)

## Hotfix — Commercial Workspace Save reverts (priced deliverables) — SHIPPING

- **SSOT:** Quotation **line** Master columns (`cost` / `revenue` / GP / AF) are authoritative (`COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md`)
- **Cause:** Line Save omitted deliverable sync; `draftFromQuotationItem` re-rolled stale priced deliverables on remount
- **Fix:** Prefer line Master on remount · strip deliverable commercials on line-Master Save (same UPDATE) · pending-diff no longer early-returns on deliverable equality · rebuild drafts from server when no unsaved changes
- Regression: `lib/quotations/quotation-commercial-ssot-save-regression.test.ts` (edit → save → remount → Preview/Generate)

## Prior closed

**Apify Manual Refresh:** CLOSED · Enterprise Ready · Production PASS (`937dd503`)  
**Studio + Creator Detail progressive load:** on `develop`

## Dev infra (separate)

Railway Dev worker crash — `BACKLOG_DEV_RAILWAY_WORKER_REDIS_LOG_RATE_LIMITS.md`
