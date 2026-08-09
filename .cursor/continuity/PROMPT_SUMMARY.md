# Prompt Summary — Current Sprint

**Branch:** `feature/discovery-search-shortlist-fix` (from `develop`)  
**Focus:** Discovery creator search accuracy/speed + bulk shortlist add

## In progress — Creator search + shortlist bulk add

- Paste profile URL → extract `@handle`, exact match only (no fuzzy wrong creators)
- Name-only search stays hybrid (suggestions OK)
- Fixed `parseProfileInput` treating bare words (`travel`, `reem`) as Instagram profiles
- Search debounce 700→280ms; exact lookup uses equality + smaller page
- Bulk shortlist: one server action + chunked insert (fixes 24 selected → ~12 saved)
- Tests: intent engine + parse-profile-url — PASS
- Not committed / not shipped yet

## Shortlist / Quotation export quality — SHIPPED

- Commit: `f33bef57` — workspace selection SSOT · Preview chrome · PDF/PPTX layout
- Live smoke (Liwa): Selection · Preview · PDF · PPTX — **PASS**

## Hotfix — Quotation PPTX won't open in PowerPoint — SHIPPED

- Fix: `b95b72fd` — PNG icons + SVG guard
- Prod: aliased to https://app.thinkwaymedia.com

## Hotfix — Commercial Workspace Save reverts (priced deliverables) — SHIPPED

- **SSOT:** Quotation **line** Master columns are authoritative (`COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md`)
- **Cause:** Line Save left stale priced deliverables; remount preferred deliverable rollup over saved line
- **Fix commits:** `0e74e6b7` · `dffa31de` (Json cast)
- Prefer line Master on remount · strip deliverable commercials in same UPDATE · pending-diff cost/revenue always checked · rebuild drafts when no unsaved changes
- Regression: `lib/quotations/quotation-commercial-ssot-save-regression.test.ts`
- Preview: `dpl_BxySjuxkLi3SrUfStgN2JRTJCd8f` → https://dev.thinkwaymedia.com — Dev DB smoke **PASS**
- Production: `dpl_52DcUDavbMQnK4wCTfTnbPHfhnAe` → https://app.thinkwaymedia.com
- Prod UI smoke `QT-2026-0009-V2`: edit cost 21000→21111 · Save · hard remount · BASE COST **972,311** · CW shows **21111** — **PASS**

## Prior closed

**Apify Manual Refresh:** CLOSED · Production PASS (`937dd503`)  
**Studio + Creator Detail progressive load:** on `develop`

## Dev infra (separate)

Railway Dev worker crash — `BACKLOG_DEV_RAILWAY_WORKER_REDIS_LOG_RATE_LIMITS.md`
