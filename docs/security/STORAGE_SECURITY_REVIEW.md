# Storage Security Review (P4)

## Buckets reviewed

| Bucket | Public? | SELECT (authenticated) | INSERT | Notes |
|--------|---------|------------------------|--------|-------|
| `campaign-publication-media` | No | **P4:** `is_internal_user()` + `campaigns.read` | service_role | Was open SELECT → fixed `20260724180000` |
| `creator-imports` | No | discovery.read/write/admin | internal + discovery.write/admin | Immutable UPDATE/DELETE for users |
| Client / vendor IO documents | No | Permission-scoped policies | Permission-scoped | See IO document migrations |
| Other media | Varies | See `supabase/storage.sql` | Often `is_internal_user()` | Prefer internal-only writes |

## Signed URLs

- Generated server-side with the caller’s Supabase client or service role for worker outputs.
- Portal actors cannot call internal export/document APIs (middleware + classification).
- Do not return long-lived signed URLs for cross-tenant objects in portal responses.

## Cross-tenant prevention

1. Path/API deny for portal → internal download endpoints.  
2. RLS on `storage.objects` using `is_internal_user()` / permissions.  
3. Object paths should include entity IDs; workers write under known prefixes.  
4. Service-role SELECT retained only for workers/admin cleanup.

## Penetration expectations

| Attempt | Result |
|---------|--------|
| Portal user lists `campaign-publication-media` | Denied by RLS after P4 migration |
| Portal user hits `/api/quotations/[id]/export` | 403 workspace middleware |
| Staff without `campaigns.read` | Denied SELECT on publication media |
| Wrong-tenant signed URL guess | Opaque UUID paths + RLS; still rotate short TTL in producers |

## Residual risk

- Pre-P4 environments until migration applied.  
- Signed URL leakage if an internal user pastes URLs to portal users — process/control, not RLS.
