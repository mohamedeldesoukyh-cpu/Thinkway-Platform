# Migration Verification — Pilot Launch

**Target Supabase project:** `hsxrewjcbvmbkqdlzjhs` (thinkway-dev) or dedicated pilot project  
**Application commit:** `e0c77d6`  
**Date:** 19 Jun 2026  
**Owner:** DBA / Ops

This document lists every migration required for pilot, how to verify it is applied, and how to remediate gaps.

---

## 1. Verification methods

### Method A — Supabase CLI (preferred)

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase migration list
```

**Pass:** Every local file in `supabase/migrations/` shows as applied on Remote with no drift.

### Method B — SQL Editor (when CLI history is broken)

Run the verification queries in §3 below in Supabase → SQL Editor.

### Method C — Consolidated patch (fallback)

If individual migrations failed or history diverged, run once:

`supabase/scripts/production_client_classification_audit.sql`

Then apply Phase A migrations (§2.1) if not already applied.

**After any SQL change:** Supabase Dashboard → **Settings → API → Reload schema**.

---

## 2. Required migrations by priority

### P0 — Phase A security (pilot blocker)

| Migration file | What it does | Verify query (§3) |
|----------------|--------------|-------------------|
| `20260629010000_profile_role_escalation_guard.sql` | Blocks self-service `role_id` / `is_active` / `status` change | §3.1 |
| `20260629020000_io_document_buckets_private.sql` | Sets `vendor-io-documents` + `client-io-documents` to `public = false` | §3.2 |

**Apply if missing:**

```bash
# Via CLI
npx supabase db push

# Or paste file contents into SQL Editor
```

---

### P0 — Client taxonomy & optional columns (pilot blocker)

These fix client save, campaign commercial profile, and classification persistence.

| Migration file | What it does |
|----------------|--------------|
| `20260625010000_client_name_ar.sql` | `clients.name_ar` |
| `20260625020000_client_category_taxonomy.sql` | `client_category` / `client_subcategory` as text slugs |
| `20260625030000_client_vr_rate.sql` | `clients.vr_rate_id` |
| `20260626020000_client_vr_rate_fkey.sql` | FK to `md_vr_rates` |
| `20260626010000_client_credit_limit_controls.sql` | `credit_limit_active`, `accept_credit_risk` |
| `20260627010000_client_classification_audit.sql` | Classification audit columns |
| `20260628010000_client_classification_review.sql` | `needs_review` + review queue |
| `20260628020000_client_classification_cache.sql` | `client_classification_cache` table |

**Consolidated fallback:** `supabase/scripts/production_client_classification_audit.sql` (covers all above in one idempotent script).

**Verify:** §3.3–§3.5

---

### P0 — Billing / invoice RLS (finance pilot blocker)

| Migration file | What it does | Verify |
|----------------|--------------|--------|
| `20260531620000_billing_invoice_rls_hardening.sql` | Removes permissive invoice policies | §3.6 |

---

### P1 — Core lifecycle (should already be applied)

| Migration file | What it does |
|----------------|--------------|
| `20260609000000_disable_operational_bootstrap.sql` | No auto Line A on campaign create |
| `20260608010000_campaign_line_status_invariants.sql` | Line status integrity |
| `20260608020000_operational_entity_integrity.sql` | Operational entity FKs |
| `20260531620000_billing_invoice_rls_hardening.sql` | Invoice RLS |
| `20260614010000_vendor_io_document_generation.sql` | Vendor IO storage bucket (created) |
| `20260618010000_client_io_document_generation.sql` | Client IO storage bucket (created) |

**Verify build-info:** `/api/build-info` → `schema.operationalStatusReadable: true` (when signed in).

---

## 3. SQL verification queries

Run in Supabase SQL Editor. Record results in §4.

### 3.1 Role escalation guard (Phase A)

```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass
  AND tgname = 'guard_profile_privileged_columns';
```

**Pass:** One row returned, `tgenabled` = `O` (enabled).

**Functional test (as non-admin user):**

```sql
-- Should FAIL with: Insufficient privileges to modify role or account status
UPDATE public.profiles
SET role_id = (SELECT id FROM roles WHERE slug = 'super_admin' LIMIT 1)
WHERE id = auth.uid();
```

---

### 3.2 IO buckets private (Phase A)

```sql
SELECT id, public, file_size_limit
FROM storage.buckets
WHERE id IN ('vendor-io-documents', 'client-io-documents');
```

**Pass:** Both rows show `public = false`.

---

### 3.3 Client taxonomy columns (text, not enum)

```sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clients'
  AND column_name IN (
    'name_ar',
    'client_category',
    'client_subcategory',
    'vr_rate_id',
    'credit_limit_active',
    'accept_credit_risk',
    'classification_source',
    'needs_review'
  )
ORDER BY column_name;
```

**Pass:** All 8 columns exist; `client_category` and `client_subcategory` show `data_type = text` (not `USER-DEFINED` enum).

**Enum check (should return 0 rows after migration):**

```sql
SELECT typname FROM pg_type
WHERE typnamespace = 'public'::regnamespace
  AND typname = 'client_category';
```

**Pass:** No rows (enum dropped).

---

### 3.4 Classification cache table

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'client_classification_cache'
) AS cache_table_exists;
```

**Pass:** `true`.

---

### 3.5 Client documents table + bucket

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'client_documents'
) AS client_documents_exists;

SELECT id, public FROM storage.buckets WHERE id = 'client-documents';
```

**Pass:** Table exists; bucket `public = false`.

---

### 3.6 Invoice RLS (no permissive policies)

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('invoices', 'invoice_line_items')
ORDER BY tablename, policyname;
```

**Pass:** Policies exist; no `USING (true)` permissive allow-all for authenticated on invoices (review output manually).

---

### 3.7 Migration history snapshot

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;
```

**Pass:** Latest versions include at minimum:
- `20260629020000`
- `20260629010000`
- `20260625020000` (or consolidated patch applied manually — document in §4)

---

## 4. Verification log (fill in during pilot prep)

| Check | Query § | Result | Verified by | Date |
|-------|---------|--------|-------------|------|
| Role escalation trigger | 3.1 | ☐ Pass ☐ Fail | | |
| IO buckets private | 3.2 | ☐ Pass ☐ Fail | | |
| Client taxonomy columns | 3.3 | ☐ Pass ☐ Fail | | |
| No legacy enum | 3.3 | ☐ Pass ☐ Fail | | |
| Classification cache | 3.4 | ☐ Pass ☐ Fail | | |
| Client documents | 3.5 | ☐ Pass ☐ Fail | | |
| Invoice RLS | 3.6 | ☐ Pass ☐ Fail | | |
| Migration history | 3.7 | ☐ Pass ☐ Fail | | |
| Schema cache reloaded | Manual | ☐ Pass ☐ Fail | | |

---

## 5. Remediation procedures

### If client_category is still enum

Run section 1 of `supabase/scripts/production_client_classification_audit.sql`, then reload schema cache.

### If Phase A migrations missing

1. Open `20260629010000_profile_role_escalation_guard.sql` → SQL Editor → Run  
2. Open `20260629020000_io_document_buckets_private.sql` → SQL Editor → Run  
3. Reload schema cache  
4. Re-run §3.1 and §3.2

### If migration history diverged (duplicate versions)

Do **not** force-push migration history. Apply idempotent SQL scripts manually and log versions applied in §4.

---

## 6. Post-migration application checks

After migrations applied, redeploy `e0c77d6` and verify:

1. `GET /api/build-info` → `gitSha` starts with `e0c77d6`
2. Sign in → open `/api/build-info` → `schema.operationalStatusReadable: true`
3. Create/edit client with category → save → refresh → category persists
4. Generate Vendor IO → PDF opens (signed URL, not public bucket URL)

---

## 7. Sign-off

| Role | Name | Date | Migrations verified |
|------|------|------|:-------------------:|
| DBA / Ops | | | ☐ |

**Pilot migration gate:** All P0 rows in §4 must be **Pass** before pilot users are invited.

---

## Cross-references

- `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` §2
- `docs/PILOT_LAUNCH_CHECKLIST.md`
- `supabase/scripts/production_client_classification_audit.sql`
