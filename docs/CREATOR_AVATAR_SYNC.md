# Creator Avatar Sync

Production rules for synchronizing creator profile photos from Apify metrics collection into `influencer_platform_accounts.profile_picture_url`.

## Data model

| Column | Purpose |
|--------|---------|
| `profile_picture_url` | Platform-specific creator photo URL |
| `avatar_source` | Origin: `manual`, `apify`, `discovery`, `uploaded` |
| `avatar_last_synced_at` | Last automated refresh timestamp |

Migration: `supabase/migrations/20260630010000_creator_avatar_sync.sql`

Existing rows default to `avatar_source = manual` so manually curated photos are never overwritten by automated sync.

## Extraction (Apify)

During metrics collection, `pickApifyAuthorAvatarUrl()` reads author metadata from Apify post-scraper payloads:

- **TikTok** — `authorMeta.originalAvatarUrl`, `authorMeta.avatar`, nested `author` fields
- **Instagram** — `ownerProfilePicUrl`, nested `owner` / `author` profile pic fields
- **YouTube / others** — `channel.avatarUrl`, generic `authorAvatar` fields

Implementation: `lib/performance/apify-author-avatar.ts`

Platform safety is enforced before persist/display via `isAvatarUrlAllowedForPlatform()` in `lib/performance/creator-avatar.ts` (Instagram CDN blocked on TikTok rows, TikTok CDN blocked on Instagram rows, etc.).

## Overwrite policy

Automated sync runs in `persistInfluencerPlatformAvatar()` (`lib/performance/metrics-collector/persist.ts`).

| Condition | Sync allowed? |
|-----------|---------------|
| `avatar_source = manual` and URL present | **Never** |
| `avatar_source = manual` and URL empty | Yes (first fill) |
| URL null, empty, placeholder, or broken heuristic | Yes |
| `avatar_source = apify` and `avatar_last_synced_at` > 30 days | Yes |
| Fresh non-manual avatar (< 30 days) | No |

Placeholder/broken detection (no HEAD requests): `lib/performance/avatar-sync-policy.ts`

Manual vendor edits via platform accounts editor set `avatar_source = manual`.

Discovery enrichment sets `avatar_source = discovery`.

## Display fallback hierarchy

Single resolver: `resolvePublicationCreatorAvatar()` / `resolveCreatorAvatarDisplay()` in `lib/performance/creator-avatar.ts`.

UI component: `PublicationCreatorAvatar` in `lib/performance/publication-creator-identity.tsx`.

| Priority | Source |
|----------|--------|
| 1 | `influencer_platform_accounts.profile_picture_url` (platform-matched) |
| 2 | `influencers.metadata.avatar_url` |
| 3 | Cached Apify author avatar (optional `apify_author_avatar_url` on row) |
| 4 | Discovery profile image (`discovered_profiles.profile_image_url`) — Instagram / unknown only |
| 5 | Generated initials |
| 6 | Platform icon |

Used in: publication grid, publication workspace, performance detail drawer, HTML/PPTX reports.

## Quotation workspace (hard guarantee)

`enrichQuotationItemsForWorkspace` must resolve avatars at **export quality**:

1. Creator DNA durable `creator-avatars` URL (canonical)
2. Ranked `influencers.primary_avatar_url` + platform account photos + line snapshot
3. Persist recovered URLs onto `quotation_items.profile_image_url`
4. Background `stabilizeCreatorAvatar` for lines still on null / expired CDN

Shortlist → quotation seeds prefer durable storage over ephemeral IG/TikTok CDN (`pickBestQuotationSeedAvatarUrl`).

Proxy: negative cache must still set `needsRefresh` when a profile URL (or expired IG CDN) can recover — otherwise client retries stick on the grey silhouette.

## Backfill

```bash
npm run backfill:creator-avatars
npm run backfill:creator-avatars -- --platform=instagram
npm run backfill:creator-avatars -- --platform=tiktok
npm run backfill:creator-avatars -- --all
npm run backfill:creator-avatars -- --dry-run
```

Script: `scripts/backfill-creator-avatars.ts`

Flow:

1. Select platform accounts where `shouldSyncPlatformAvatar()` is true
2. Find most recent publication with `content_url` per account
3. Try lightweight extraction from `publication_metric_sync_logs.response_summary.authorAvatarUrl`
4. If missing and Redis available → enqueue metrics job
5. Otherwise inline metrics collection → persist via `persistInfluencerPlatformAvatar()`

Without `--all`, batches over 50 accounts require explicit confirmation flag.

## Tests

```bash
npm run test:creator-avatar
npm run test:apify-author-avatar
npm run test:avatar-sync-policy
npm run test:metrics-sync-poll-policy
npm run test:campaign-performance
```
