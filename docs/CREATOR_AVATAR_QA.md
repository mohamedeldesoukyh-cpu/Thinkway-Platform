# Creator Avatar Sync — QA Checklist

Use this checklist when validating avatar sync after deploy or backfill.

## Pre-requisites

- [ ] Migration `20260630010000_creator_avatar_sync.sql` applied
- [ ] `APIFY_TOKEN` configured (for live extraction)
- [ ] Optional: `REDIS_URL` for queued backfill

## Platform safety

### TikTok publication rows

- [ ] Row with TikTok platform account photo shows TikTok CDN avatar
- [ ] Row **without** TikTok platform photo does **not** show Instagram discovered/metadata avatar
- [ ] Fallback is platform icon or initials — never Instagram CDN image

### Instagram publication rows

- [ ] Platform account photo preferred over influencer metadata avatar
- [ ] Discovery / metadata avatars allowed when no platform photo

### Cross-platform vendor

- [ ] Creator with IG-only discovered profile + TikTok publication → TikTok row shows TT icon/initials, IG row shows photo

## Sync behavior (metrics collection)

- [ ] New publication metrics sync with empty platform account photo → `profile_picture_url` populated
- [ ] `avatar_source` set to `apify`, `avatar_last_synced_at` updated
- [ ] Second sync within 30 days does **not** replace existing apify photo
- [ ] Manual photo on platform account (`avatar_source = manual`) never replaced by metrics sync

## Manual vendor edit

- [ ] Upload/ paste URL in platform accounts editor → saves with `avatar_source = manual`
- [ ] Subsequent Apify metrics sync does not overwrite manual photo

## Display surfaces

| Surface | Check |
|---------|-------|
| Campaign performance grid | Creator column avatar matches platform |
| Publication workspace header | Same avatar as grid |
| Performance detail drawer (media drawer) | Same avatar + initials fallback when no URL |
| Combined performance report | Inline creator avatar in publication cards |
| Influencer section report | Primary platform avatar on influencer header |
| Discovery compare matrix | Primary platform `profile_image_url` renders |

## Backfill script

```bash
npm run backfill:creator-avatars -- --dry-run --platform=tiktok
```

- [ ] Dry run lists eligible accounts without writes
- [ ] `--platform=instagram` scopes correctly
- [ ] `--platform=tiktok` scopes correctly
- [ ] With Redis: jobs enqueued for accounts missing cached log avatar
- [ ] Without Redis: inline collection attempts run
- [ ] Manual avatars skipped in output

## Regression tests

```bash
npm run test:creator-avatar
npm run test:apify-author-avatar
npm run test:avatar-sync-policy
npm run test:metrics-sync-poll-policy
npm run test:campaign-performance
```

All must pass before release.

## Known limitations

- Placeholder/broken URL detection is heuristic-only (no HTTP HEAD)
- Apify display fallback requires cached `authorAvatarUrl` in sync logs unless platform account already synced
- Compare workspace uses unified browse primary account photo (not publication-scoped resolver)

## Sign-off

| Role | Name | Date | Pass |
|------|------|------|------|
| Engineering | | | |
| QA | | | |
| Product | | | |
