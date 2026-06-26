# Campaign Performance Report — Final QA

**Date:** 2026-06-23  
**Scope:** Combined + Influencer PDF/HTML reports, performance grid, media drawer, Instagram metrics

## Automated checks

| Check | Command | Expected |
|---|---|---|
| Metrics collector unit tests | `npm run test:metrics-collector` | All pass |
| Screenshot capture tests | `npm run test:screenshot-capture` | All pass |
| TypeScript | `npx tsc --noEmit` | No errors |

## Manual HTML smoke test

1. Open a campaign with publications: `/campaigns/{id}` → **Performance** tab.
2. Export reports:
   - Combined: `/api/campaigns/{id}/performance/document?format=html&variant=combined`
   - Influencer: `/api/campaigns/{id}/performance/document?format=html&variant=influencers`
3. Optional PDF: append `&download=1` with `format=pdf`.

## Grid validation

| Item | Expected |
|---|---|
| **Thumb** column | Creator avatar (round); never post screenshot |
| **Preview** column | Post screenshot or thumbnail; em dash if none |
| Avatar priority | creator profile → influencer metadata avatar → platform account picture → initials |
| Metrics columns | Unchanged values vs pre-change |
| Screenshot pipeline | Unaffected; drawer Media tab still shows publication screenshot |

## Media drawer validation

| Item | Expected |
|---|---|
| Creator avatar + platform badge + date | Visible in Media tab header |
| Metrics summary cards | Views, Likes, Comments, ER |
| Open in platform | Links to `content_url` |
| Download screenshot | Enabled when screenshot/thumbnail exists |
| Source provider badge | Shows `metrics_provider` / collection source |
| Screenshot timestamp | Shows `screenshot_captured_at` when set |

## Report branding (IO-aligned)

| Token | Value |
|---|---|
| Primary background | `#020B26` |
| Secondary | `#0B1E59` |
| Accent | `#1E5EFF` |
| Text on dark | `#FFFFFF` |
| Cards | `#F8FAFC` |

**Verify:** No green (`#1D9E75`) gradients on cover, TOC numbers, bar charts, or section badges.

## Combined report sections

- [ ] Cover: hero/cover image or brand logo when available
- [ ] Cover: platform badges for active platforms
- [ ] Cover: QR code → campaign dashboard URL
- [ ] Campaign Highlights (top creator, best post, highest ER, total engagements)
- [ ] Benchmark table (avg ER by platform) + recommendations
- [ ] Platform breakdown + charts + publication gallery
- [ ] Thank You closing page (dark branded, contact details, confidential footer)
- [ ] Page footer on body pages: Confidential · Thinkway Platform + page numbers

## Influencer report sections

- [ ] Per-influencer page break with cover (avatar, handles, follower count, KPI row)
- [ ] Performance summary charts (views + engagement by publication)
- [ ] Full-width publication cards with screenshot, caption excerpt, metrics, ER
- [ ] Insights block (auto-generated)
- [ ] Audience snapshot (gender/location/followers when available)
- [ ] Thank You closing page

## Instagram metrics (Shimaa Saber case)

See [SHIMAA_INSTAGRAM_METRICS_ROOT_CAUSE.md](./SHIMAA_INSTAGRAM_METRICS_ROOT_CAUSE.md).

- [ ] IG posts with hidden likes: comments preserved, likes/views null, status `completed`, confidence 70

## Regression guardrails

- Do not modify Apify actor IDs or screenshot capture providers in this pass
- Metrics collection orchestrator stop-on-apify behaviour unchanged
- Report exports reuse existing PDF infrastructure (`PERFORMANCE_REPORT_PDF_OPTIONS`)

## Sign-off

| Role | Name | Date | Pass |
|---|---|---|---|
| Engineering | | | |
| Ops / AM | | | |
