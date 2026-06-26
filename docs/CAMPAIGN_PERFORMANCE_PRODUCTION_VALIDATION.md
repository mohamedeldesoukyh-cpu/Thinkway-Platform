# Campaign Performance — Production Validation Report

**Date:** 2026-06-23  
**Environment:** Production Supabase (`hsxrewjcbvmbkqdlzjhs.supabase.co`)  
**Validator:** Automated audit + code/test validation

---

## Executive summary

| Area | Status | Notes |
| --- | --- | --- |
| Production DB audit | **BLOCKED** | `fetch failed` from validation host (network cannot reach Supabase) |
| Code regression tests | **PASS** | `test:campaign-performance`, `test:metrics-collector`, `test:campaign-performance-audit` |
| Health endpoint | **IMPLEMENTED** | `GET /api/admin/campaign-performance/health` |
| Scheduled monitoring | **IMPLEMENTED** | Daily cron `GET /api/cron/campaign-performance-monitor` (06:00 UTC) |
| Metrics refresh script | **IMPLEMENTED** | `npm run refresh:affected-creator-metrics` |
| UI browser validation | **BLOCKED** | Browser MCP unavailable; dev server running on `:3000` |
| Screenshots | **PENDING** | Capture manually after production audit (see `docs/screenshots/campaign-performance/`) |

**Sign-off recommendation:** **CONDITIONAL GO** — deploy monitoring + health endpoint, then run production audit from a network that can reach Supabase (Vercel cron, CI, or local machine with connectivity).

---

## 1. Production audit

### Attempt

```bash
npm run audit:campaign-performance
```

### Result

```
TypeError: fetch failed
```

Repeated connectivity probe to `https://hsxrewjcbvmbkqdlzjhs.supabase.co/rest/v1/` failed with:

```
err UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

Credentials are present in `.env` (10 vars injected). Failure is a **local TLS certificate chain** issue (common on corporate networks / missing root CAs), not missing auth or Supabase downtime.

### Expected output (when reachable)

The audit writes `docs/CAMPAIGN_PERFORMANCE_FINAL_AUDIT.md` with:

| Metric | Field |
| --- | ---: |
| Total publications scanned | `totalPublications` |
| Missing creator avatars | `missingAvatarsCount` |
| Missing preview screenshots | `missingPreviewScreenshotsCount` |
| Missing metrics | `missingMetricsCount` |
| Platform mismatches | `platformMismatchesCount` |
| Recoverable metrics (sync log regression) | `recoverableMetricsCount` |

### Post-deploy verification

1. **Vercel cron** (after deploy): `GET /api/cron/campaign-performance-monitor` with `Authorization: Bearer $CRON_SECRET`
2. **Admin health**: `GET /api/admin/campaign-performance/health` (admin / `operations.read` session, or `CRON_SECRET`)
3. **CLI audit**: `npm run audit:campaign-performance` from a connected machine

---

## 2. Root causes confirmed (code + prior investigation)

| # | Issue | Root cause | Fix status |
| --- | --- | --- | --- |
| 1 | THUMB showed post art, not creator face | Grid used `thumbnail_url` for avatar column | **Fixed** — `AvatarThumb` uses creator avatar chain; `ContentPreviewThumb` uses screenshot/thumbnail |
| 2 | TikTok rows showed Instagram icon | Post thumbnails + `detectPublicationPlatform` defaulted to `instagram` | **Fixed** — platform icon fallback from `row.platform`; detection returns `unknown` not IG |
| 3 | Metrics disappeared after sync | `persistCollectedMetrics` wrote nulls over populated values | **Fixed** — `mergeCollectedMetrics` uses `incoming ?? existing` |
| 4 | Shimaa IG carousels stuck `partial` | Apify `-1` likes + strict completion rules | **Fixed** — sanitizer drops negatives; `completed` when views/likes/comments any present |
| 5 | Hussein / others metrics regression | Same null-overwrite path | **Fixed** — merge preservation; recoverable from `publication_metric_sync_logs` |

### Prior verified data (Shimaa Saber — from `docs/SHIMAA_SABER_PARTIAL_METRICS.md`)

| Publication | Before | After re-sync |
| --- | --- | --- |
| `71764674-6045-4376-84b6-2759a6367d57` | likes: -1, comments: 108, status: partial | likes: null, comments: 108, status: **completed** |
| `253bc521-fa0b-4714-b547-0c1d26191e43` | likes: -1, comments: 32, status: partial | likes: null, comments: 32, status: **completed** |

Campaign: Arab Bank X La Liga (`20374f67-1c2f-4df0-b999-124a8d506c3c`) — mixed Instagram/TikTok.

---

## 3. Affected creators

Target creators for validation:

| Creator | Pattern | Campaign reference |
| --- | --- | --- |
| Shimaa Saber | `/shimaa/i` | `20374f67-1c2f-4df0-b999-124a8d506c3c` |
| Hussein Elmaghraby | `/hussein/i` | (audit lists per-publication when DB reachable) |
| Mohamed Shaiban | `/shaiban/i` | (audit lists per-publication when DB reachable) |

**Refresh command** (logs BEFORE/AFTER per publication, exits non-zero on null regression):

```bash
npm run refresh:affected-creator-metrics
```

Blocked in this session by same Supabase connectivity issue.

---

## 4. UI validation (code-verified)

Source: `campaign-performance-grid.tsx`

| Check | Implementation |
| --- | --- |
| Creator avatar in THUMB column | `AvatarThumb` → `resolveCreatorAvatarUrl()` chain |
| Screenshot/preview in Preview column only | `ContentPreviewThumb` → `resolvePublicationContentPreviewUrl()` |
| Platform icon per row | `PlatformIcon platform={row.platform}` when no avatar |
| TikTok ≠ Instagram icon | `PLATFORM_ICON_STYLES` keyed by normalized platform |
| Empty avatar → platform icon | `AvatarThumb` falls back to `<PlatformIcon />` |

**Manual UI check** (when signed in):

```
/campaigns/20374f67-1c2f-4df0-b999-124a8d506c3c?tab=performance
```

---

## 5. Infrastructure delivered

### Health endpoint

`GET /api/admin/campaign-performance/health`

```json
{
  "ok": true,
  "scannedAt": "ISO-8601",
  "totalPublications": 0,
  "missingAvatarsCount": 0,
  "missingPreviewScreenshotsCount": 0,
  "missingMetricsCount": 0,
  "platformMismatchesCount": 0,
  "recoverableMetricsCount": 0
}
```

Auth: `super_admin` / `admin` / `operations.read`, or `Authorization: Bearer $CRON_SECRET`.

### Scheduled monitoring

- **Path:** `/api/cron/campaign-performance-monitor`
- **Schedule:** `0 6 * * *` (daily 06:00 UTC) in `vercel.json`
- **Alerts:** metrics regression, avatar resolution, platform mismatch, screenshot missing, empty metrics
- **Webhook (optional):** `CAMPAIGN_PERFORMANCE_ALERT_WEBHOOK` or `ALERT_WEBHOOK_URL`
- **Logging:** structured JSON to stdout (Vercel logs)

### Shared audit library

- `lib/performance/campaign-performance-audit.ts` — used by audit script, health endpoint, and monitor cron
- `lib/performance/campaign-performance-monitoring.ts` — alert builder + webhook dispatch

---

## 6. Tests run

| Command | Result |
| --- | --- |
| `npm run test:campaign-performance` | PASS |
| `npm run test:metrics-collector` | PASS |
| `npm run test:campaign-performance-audit` | PASS |

---

## 7. Remaining risks

1. **Production counts unknown** until audit runs on a connected host — `recoverableMetricsCount` may be > 0 for legacy rows.
2. **Screenshot backlog** — publications without `screenshot_url`/`thumbnail_url` depend on discovery-worker screenshot scheduler (`*/15 * * * *`).
3. **Instagram hidden likes** — Apify returns `-1`; stored as `null` (correct). Comments-only posts show `completed` not `partial`.
4. **Avatar gaps** — creators without `discovered_profiles`, metadata avatars, or `influencer_platform_accounts` pictures will show platform icon fallback (by design).
5. **Provider outages** — Apify/TikTok API failures still yield `failed`/`manual_required`; merge fix prevents data loss on partial returns.

---

## 8. Sign-off

| Decision | Rationale |
| --- | --- |
| **CONDITIONAL GO** | All code fixes tested; monitoring + health endpoint ready for deploy |
| **Complete GO criteria** | Production audit returns `recoverableMetricsCount: 0` (or refresh applied), health endpoint green, UI screenshots captured |

### Post-deploy checklist

- [ ] Deploy to Vercel (includes new cron + health route)
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/campaign-performance-monitor`
- [ ] `npm run audit:campaign-performance` from connected machine
- [ ] `npm run refresh:affected-creator-metrics` if regressions found
- [ ] Capture screenshots to `docs/screenshots/campaign-performance/`
- [ ] Confirm Shimaa/Hussein/Shaiban rows in Performance Center
