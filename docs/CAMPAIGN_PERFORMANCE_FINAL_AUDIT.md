# Campaign Performance Final Audit

Generated: 2026-06-23 (architecture fix release)

> **Note:** Run `npm run audit:campaign-performance` against a connected Supabase instance to refresh live publication counts. The scan below documents root causes fixed in code; live row counts populate when the audit script can reach the database.

## Summary

| Check | Status |
| --- | --- |
| THUMB column shows creator avatar (not post thumbnail) | Fixed |
| Platform icon fallback per publication platform | Fixed |
| Metrics merge preserves existing values on null sync | Fixed |
| TikTok publications no longer default to Instagram provider chain | Fixed |
| Shimaa / Hussein metrics recoverable from sync logs | Re-run refresh or manual import |

## Root cause analysis

### 1. Creator profile photos not displayed

**Cause:** The Performance grid THUMB column rendered `thumbnail_url` (post/screenshot preview). For Instagram posts this often looks like Instagram-branded artwork, not the creator's face.

**Fix:**
- Split columns: **Thumb** = creator avatar (`profile_image_url` → `avatar_url` → social `profile_picture_url`); **Preview** = `screenshot_url` → `thumbnail_url`.
- `loadInfluencerMeta()` in `features/campaigns/queries/publications.ts` hydrates avatars from `discovered_profiles`, influencer `metadata.profile_image_url`, `metadata.avatar_url`, and `influencer_platform_accounts.profile_picture_url`.
- Platform-specific fallback icon only when no avatar URL exists (`lib/performance/platform-icon.tsx`).

### 2. Wrong platform icon (TikTok showing Instagram)

**Cause:** Two issues:
1. THUMB showed post thumbnails (often IG-styled) regardless of platform.
2. `detectPublicationPlatform()` defaulted to `"instagram"` when URL parsing failed, routing TikTok rows through the Instagram Apify actor.

**Fix:**
- Platform icon fallback uses `row.platform` (dynamic IG/TT/YT/SC/FB badges).
- Detection returns `"unknown"` instead of defaulting to Instagram; collector resolves platform from the publication row before choosing provider chain.

### 3. Metrics disappeared after sync

**Cause:** `persistCollectedMetrics()` wrote sanitized nulls directly to `campaign_publications`, overwriting populated `views`/`likes`/`comments` when a provider returned partial or empty payloads (e.g. hidden Instagram likes as `-1` → `null`).

**Fix:**
- `mergeCollectedMetrics()` now prefers **valid incoming** values but **never replaces with null** (`incoming ?? existing`).
- Collector seeds merge from `storedMetricsFromPublication()` (includes legacy `engagement_*` columns).
- `persistCollectedMetrics()` loads existing DB metrics and merges before write.

### 4. Shimaa Saber Instagram posts missing metrics

**Cause:** Same null-overwrite path; comments-only posts marked `completed` but views/likes cleared on subsequent sync when Apify returned `-1` or omitted fields.

**Fix:** Merge preservation + comments-only posts remain `completed` when `hasCoreMetrics()` is satisfied. Re-run **Refresh metrics** on affected rows to restore from provider or sync log snapshots.

## Files changed

| Area | Files |
| --- | --- |
| UI grid / drawer | `features/campaigns/components/performance/campaign-performance-grid.tsx`, `campaign-performance-detail-drawer.tsx` |
| Data loading | `features/campaigns/queries/publications.ts` |
| Avatar / preview | `lib/performance/creator-avatar.ts`, `publication-preview.ts`, `platform-icon.tsx` |
| Metrics architecture | `lib/performance/metrics-collector/merge-metrics.ts`, `persist.ts`, `metrics-collector.ts`, `detect-platform.ts`, `types.ts` |
| Tests | `lib/performance/campaign-performance-regression.test.ts`, `metrics-collector.test.ts` |
| Audit | `scripts/audit-campaign-performance-final.ts` |

## Verification

```bash
# Unit / regression tests
npm run test:metrics-collector
npm run test:campaign-performance

# Live DB audit (requires Supabase env)
npm run audit:campaign-performance
```

### Regression test coverage

- Creator avatar priority (profile → avatar → social picture)
- Preview column does not use creator avatar
- Metrics never overwritten by null incoming values
- Valid incoming metrics update existing rows
- Legacy `engagement_*` columns hydrate stored metrics
- Platform icons differ per platform (IG ≠ TT)

## Recovery for affected creators

1. Open Campaign → Performance Center.
2. Select affected publications (e.g. Shimaa Saber, Hussein Elmaghraby).
3. **Refresh metrics** (uses fixed merge — will not clear existing values).
4. If metrics remain empty, check `publication_metric_sync_logs.metrics_snapshot` for recoverable values and use CSV manual import.
