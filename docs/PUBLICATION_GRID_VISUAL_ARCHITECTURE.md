# Publication Grid Visual Architecture

Canonical rendering contract for campaign performance publication rows (grid, workspace header, reports). **Rendering only** — avatar sync, Apify, and metrics persistence are unchanged.

## Column contract

| Column | Purpose | Allowed content | Forbidden |
|--------|---------|-----------------|-----------|
| **THUMB** | Platform identity | Platform icon → platform fallback badge | Creator photos, post screenshots |
| **PREVIEW** | Post content | Screenshot → thumbnail → (provider preview via `thumbnail_url`) → placeholder | Creator avatars, platform icons as primary content |
| **CREATOR** | Influencer identity | `[Avatar] Name` with avatar fallback chain | Platform icons (especially when a creator photo exists) |

## Resolution priority

### THUMB (`PublicationPlatformThumb`)

```
platform icon → platform fallback badge (TT, YT, …)
```

- Resolver: `resolvePlatformThumbDisplay()` in `lib/performance/publication-grid-visual.ts`
- Component: `PublicationPlatformThumb` in `lib/performance/publication-grid-visual.tsx`
- Uses `PlatformIcon` only — **never** `resolvePublicationRowCreatorAvatar`

### PREVIEW (`PublicationContentPreviewThumb`)

```
screenshot_url → thumbnail_url → placeholder (—)
```

- Resolver: `resolvePublicationContentPreviewUrl()` in `lib/performance/creator-avatar.ts`
- Alias for reports: `resolvePublicationPreviewUrl()` in `lib/performance/publication-preview.ts` (content only; no creator fallback)
- Component: `PublicationContentPreviewThumb` in `lib/performance/publication-grid-visual.tsx`

### CREATOR (`PublicationCreatorAvatar` + `PublicationCreatorName`)

```
social_profile_picture_url (platform-matched)
  → influencers.avatar_url
  → apify_author_avatar_url
  → creator_profile_image_url (Instagram / unknown only)
  → initials (when name present, no photo)
  → placeholder (?)
```

- Resolvers: `resolvePublicationRowCreatorAvatar`, `resolveCreatorAvatarDisplay` in `lib/performance/creator-avatar.ts`
- UI: `lib/performance/publication-creator-identity.tsx`
- **Never** falls back to `PlatformIcon` — platform belongs in THUMB only

## File map

| Surface | THUMB | PREVIEW | CREATOR |
|---------|-------|---------|---------|
| Performance grid | `campaign-performance-grid.tsx` → `PublicationPlatformThumb` | `PublicationContentPreviewThumb` | `PublicationCreatorName` |
| Publication workspace | — (platform in badge) | `resolvePublicationContentPreviewUrl` hero | Header + Creator field via `PublicationCreatorName` |
| Detail drawer | — | `MediaPreview` content area | `PublicationCreatorAvatar` + name |
| HTML report cards | — (platform in pub-meta text) | `resolvePublicationContentPreviewUrl` (content only) | `renderCreatorAvatarInline` (no platform icon) |
| PPTX export | — | `resolvePublicationContentPreviewUrl` | — |

## Regression tests

```bash
npm run test:publication-grid-visual
npm run test:creator-avatar
npm run test:campaign-performance
```

Tests assert:

1. THUMB resolver always returns `platform-icon`, never creator URLs
2. PREVIEW never falls back to creator avatar URLs
3. CREATOR uses photo → initials → placeholder; never platform icons
4. Initials appear only when no creator photo is resolved

## Related docs

- `docs/CREATOR_AVATAR_SYNC.md` — avatar sync and platform-safe URL rules (business layer)
- `lib/performance/creator-avatar.ts` — shared avatar URL resolution (used by CREATOR column only)
