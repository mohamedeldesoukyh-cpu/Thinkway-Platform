# Prompt Summary — Current Sprint

**Branch:** `develop` / `main` @ `c321844d`  
**Focus:** Showcase metric cards Preview/PDF/PPTX parity — SHIPPED

## SHIPPED — Showcase metric cards (icons + K/M)

- Commit: `c321844d`
- Prod: `dpl_G9qdNNbDNp6pe9cGstozrLaMFoJn` → https://app.thinkwaymedia.com
- Engagement card: platform **avatars** + ER% (no IG/TT text)
- Platform follower cards: **Followers** header + platform avatar + **K/M** counts
- Preview · PDF · PPTX share the same card semantics
- Smoke: valid PPTX ZIP · no SVG media

## SHIPPED — Showcase PPTX redesign + ER decimals

- Commit: `7cee99fb`
- Showcase / Showcase Lump Sum PPTX match HTML redesign (cover + TOTAL INVESTMENT)
- Engagement rates: **2 decimals** in Preview/exports

## SHIPPED — Creator metrics + quotation whole numbers

- Commits: `45f9deae` · `925da7f8`
- Avg. Engagements · Avg. Likes · Avg. Reels Plays (creator detail only)
- Quotation money/counts: whole-number display (ER exception above)

## Prior closed

**Apify Manual Refresh:** CLOSED · Production PASS (`937dd503`)

## Dev infra (separate)

Railway Dev worker crash — `BACKLOG_DEV_RAILWAY_WORKER_REDIS_LOG_RATE_LIMITS.md`
