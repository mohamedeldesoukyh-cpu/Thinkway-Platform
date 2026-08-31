# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Quotation recent-publication photo quality.

## Shipped 2026-08-31

### Publication image source (`554dd812` / Production `21f527e7`)
Pixelation was the **source**, not CSS: stored TikTok EU origin covers 403, then a ~240px OG thumb was embedded and stretched. Quotation now fetches signed TikTok oEmbed origin covers (768–960px+), rejects bytes under 640px, and uses a clean placeholder instead of upscaling. Preview and PDF share the same embed path. Avatars still use Thinkway 1080×1080 storage.

- Development: https://dev.thinkwaymedia.com
- Production: https://app.thinkwaymedia.com — Git deploy `[deploy-production]` on `21f527e7`
- No database migrations

### Earlier today
- JPEG DQT quality reject (`1bd778de` / Production `7c41f32c`) — `dpl_J1kiXfG7TUJN9Q8t8TguiM7NgSZD`
- URL-only e15 skip (`e5b9693f` / `efb36654`) — insufficient alone
- Followers as K/M (`a7810f70`)
- Refresh Metrics false-failure toast (`f3c01635`)

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
