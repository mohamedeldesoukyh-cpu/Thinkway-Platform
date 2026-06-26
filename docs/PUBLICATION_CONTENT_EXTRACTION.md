# Publication content extraction

Automatic collection of **caption**, **hashtags**, and **mentions** for Instagram and TikTok publications during metrics sync.

## Pipeline

```
content URL
  → metrics collector (Apify provider)
  → extract-publication-content.ts (platform field mapping)
  → content-normalizer.ts (dedupe, Arabic hashtags, caption fallback)
  → persist.ts (DB write with manual-edit protection)
  → campaign_publications
  → publications bundle → grid / workspace / reports
```

## Apify field mapping

| Platform  | Caption                         | Hashtags              | Mentions                    |
|-----------|----------------------------------|-----------------------|-----------------------------|
| Instagram | `caption`, `captionText`, `edge_media_to_caption` | `hashtags[]` | `mentions[]`, `ownerUsername` |
| TikTok    | `text`, `desc`, `description`    | `hashtags[]`, `challenges[]`, `textExtra[]` | `mentions[]`, `detailedMentions[]`, `textExtra[]`, `authorMeta.name` |

When provider arrays are empty, hashtags and mentions are parsed from the caption via regex (including Arabic letters in hashtags).

## Database columns

| Column           | Type    | Notes                                      |
|------------------|---------|--------------------------------------------|
| `caption`        | text    | Full post caption                          |
| `hashtags`       | text    | Space-separated `#tag` tokens              |
| `mentions`       | text    | Space-separated `@handle` tokens           |
| `hashtag_count`  | integer | Denormalized count                         |
| `mention_count`  | integer | Denormalized count                         |
| `caption_source` | text    | `sync` \| `derived` \| `manual`            |
| `hashtags_source`| text    | same                                       |
| `mentions_source`| text    | same                                       |

Migration: `supabase/migrations/20260630140000_publication_content_fields.sql`

## Manual edit protection

On user save (`savePublicationDetailsAction`, `updateCampaignPublicationAction`), content fields set `*_source = manual`.

On metrics sync, provider content overwrites fields unless `*_source = manual`. Provider arrays take precedence over caption-derived (`derived`) values.

## Verification

```bash
npm run test:content-normalizer
npm run test:metrics-collector
```

Re-sync a publication with a content URL, then open **Campaign → Performance → Publication workspace → Overview** and confirm Caption / Hashtags / Mentions sections populate.

```bash
npm run test:apify-platform -- https://www.instagram.com/reel/<id>/
```

Check sync log `response_summary` for `publicationContent` keys when debugging.
