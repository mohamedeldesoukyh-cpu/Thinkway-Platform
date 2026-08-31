# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Quotation recent-publication photo quality.

## Shipped 2026-08-31

### Publication photos (`e5b9693f` / Production `efb36654`)
Tiles were posterized because Instagram `stp=dst-jpg_e15` previews are large but extra-low quality. Preview now skips those, prefers stored screenshots or e35/1080 sources, and embeds 4:4:4 JPEG.

- Development: https://dev.thinkwaymedia.com
- Production: https://app.thinkwaymedia.com — `dpl_B4wSQFa2baYE6Cj79P3CzQjFTFNH`
- No database migrations

### Earlier today
- Followers as K/M (`a7810f70`)
- Refresh Metrics false-failure toast (`f3c01635`)

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
