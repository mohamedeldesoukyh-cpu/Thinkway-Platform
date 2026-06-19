# Storage Security Audit — Phase A

**Scope:** All Supabase storage buckets in migrations + `supabase/storage.sql`  
**Date:** Jun 2026  
**Severity focus:** Critical / High only

---

## Executive summary

| Bucket | Public (before) | Public (after fix) | RLS | Verdict |
|--------|-----------------|-------------------|-----|---------|
| `client-documents` | false | false | Permission + client scope | **OK** |
| `influencer-documents` | false | false | Permission + influencer scope | **OK** |
| `group-documents` | false | false | Internal + group scope | **OK** |
| `vendor-io-documents` | **true** | **false** (migration) | Authenticated + `campaigns.read` | **Fixed** |
| `client-io-documents` | **true** | **false** (migration) | Authenticated + `campaigns.read` | **Fixed** |
| Portal uploads | false | false | Portal RLS (`20260603030000`) | **OK** |
| `campaign-documents` | — | — | **Not defined in migrations** | N/A |

**Note:** No `campaign-documents` bucket exists in the repository. Campaign attachments use entity-specific buckets.

---

## High findings (remediated)

### UP-01 — Public IO document buckets

**Source migrations:**

- `20260614010000_vendor_io_document_generation.sql` — `public: true`
- `20260618010000_client_io_document_generation.sql` — `public: true`

**Risk:** Anyone with the storage URL could fetch Vendor IO / Client IO PDFs and HTML without authentication, bypassing RLS.

**Remediation applied:**

| Change | Location |
|--------|----------|
| Set buckets private | `20260629020000_io_document_buckets_private.sql` |
| Store storage paths (not public URLs) | `lib/io/vendor-io-document-service.ts`, `lib/io/client-io-document-service.ts` |
| Signed URL / download helpers | `lib/io/io-document-storage.ts` |
| API routes use signed URLs | `app/api/vendor-ios/[id]/document/route.ts`, `app/api/client-ios/[id]/document/route.ts` |
| Client IO email PDF + view link | `features/io/actions.ts`, `lib/email/client-io-email.ts` |

**Signed URL expiry:**

- In-app API redirect: 15 minutes (default)
- Client IO email view link: 7 days (`EMAIL_SIGNED_URL_SECONDS`)

---

## Acceptable buckets (private + RLS)

### `client-documents` / `influencer-documents`

Created in `20260531120000_enterprise_master_data.sql` with `public: false`.

Policies in `supabase/storage.sql`:

- Path layout: `{entity_id}/{document_type}/{file}`
- SELECT requires read permission + entity access helper
- INSERT/UPDATE/DELETE require write permission + scope

### `group-documents`

Created in `20260531150000_group_workspace.sql` with `public: false`. Group-scoped RLS policies.

---

## Application upload validation

`lib/supabase/storage.ts`:

- Max 50 MB
- MIME allowlist (PDF, images, video, Word)
- Signed URLs for downloads (15-minute default) via `createSignedDocumentUrl()`

IO buckets additionally enforce MIME at bucket level (`text/html`, `application/pdf`).

---

## Deployment checklist

1. Apply migration `20260629020000_io_document_buckets_private.sql`
2. Deploy application code (signed URL serving)
3. Regenerate IO documents if legacy rows store expired public URLs (optional — path parser handles legacy full URLs)
4. Confirm Supabase Dashboard → Storage → both IO buckets show **Public: OFF**

---

## Residual medium items (not Phase A scope)

- No virus scanning on uploads (UP-03 in security audit)
- Portal bucket isolation — verify per-portal policies in `20260603030000_creator_client_portals.sql`
- Off-site storage backup mirror not automated — see `docs/BACKUP_VERIFICATION.md`

---

## Cross-references

- `docs/SECURITY_AUDIT.md` §10
- `docs/BACKUP_AND_RECOVERY.md` §3
- `docs/PHASE_A_SECURITY_SIGNOFF.md`
