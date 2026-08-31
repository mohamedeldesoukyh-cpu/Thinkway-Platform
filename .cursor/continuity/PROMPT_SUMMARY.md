# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Quotation recent-publication photo quality.

## Shipped 2026-08-31

### Publication photos (`1bd778de` / Production `7c41f32c`)
Tiles were still posterized after the URL-only `e15` skip: large Instagram preview JPEGs without that token still embedded. Preview now rejects low JPEG quality from quantization tables and falls through to media redirect / oEmbed / Open Graph.

- Development: https://dev.thinkwaymedia.com
- Production: https://app.thinkwaymedia.com — `dpl_J1kiXfG7TUJN9Q8t8TguiM7NgSZD`
- No database migrations

### Earlier today
- URL-only e15 skip (`e5b9693f` / `efb36654`) — insufficient alone
- Followers as K/M (`a7810f70`)
- Refresh Metrics false-failure toast (`f3c01635`)

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
