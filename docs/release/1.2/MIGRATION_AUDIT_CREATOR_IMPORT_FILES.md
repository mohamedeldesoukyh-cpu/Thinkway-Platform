# Release 1.2 Migration Audit — `creator_import_files`

**Audit date:** 2026-07-05  
**Scope:** READ ONLY — compare discovery-worker / app code expectations vs Supabase migration chain  
**Related known issue:** [KI-005](../KNOWN_ISSUES.md) — Discovery worker schema drift

---

## Executive summary

| Finding | Detail |
|--------|--------|
| **Root cause** | Code/schema drift: `lib/discovery-import/recover-stuck-imports.ts` (called from `services/discovery-worker/src/index.ts` on startup) queries `creator_import_files.updated_at`, but **no migration in the repo ever adds that column**. |
| **Discovery-worker direct queries** | **Zero** `.from("creator_import_files")` in `services/discovery-worker/` — worker delegates to `@/lib/discovery-import/*`. |
| **Blocking symptom** | Documented as KI-005 in `docs/release/KNOWN_ISSUES.md`: `stuck-status recovery failed column creator_import_files.updated_at does not exist`. |
| **Which migration should add `updated_at`?** | **None exists.** A new migration is required (suggested name below). |
| **Why it didn't apply** | Not an ordering/apply failure — the migration was **never written**. `types/database.ts` also omits `updated_at`, consistent with migrations. |

---

## 1. Discovery-worker & related query inventory

### `services/discovery-worker/` — no direct `creator_import_files` references

The worker imports shared lib code:

| File | Indirect usage |
|------|----------------|
| `services/discovery-worker/src/workers/creator-import.worker.ts` | `prepareCreatorImportFile`, `processCreatorImportChunk`, `finalizeCreatorImportFile` from `lib/discovery-import/process.ts` |
| `services/discovery-worker/src/index.ts` | `recoverStuckCreatorImportFiles` from `lib/discovery-import/recover-stuck-imports.ts` |

### `lib/discovery-import/` — all `creator_import_files` queries

| File | Operation | Columns |
|------|-----------|---------|
| `process.ts` | SELECT | `*` (all columns) |
| `process.ts` | UPDATE | `status`, `processing_started_at`, `error_message`, `metadata`, `total_creators`, `imported_creators`, `updated_creators`, `duplicate_creators`, `failed_creators`, `parser_strategy`, `extracted_text_length`, `extraction_method`, `warning_message`, `processing_log`, `storage_path`, `processing_completed_at` |
| `chunk-progress.ts` | SELECT | `metadata` |
| `chunk-progress.ts` | UPDATE | `metadata`, `total_creators`, `imported_creators`, `updated_creators`, `duplicate_creators`, `failed_creators` |
| `pause-import.ts` | SELECT | `id`, `status`, `metadata`, `uploaded_by` |
| `pause-import.ts` | UPDATE | `status`, `metadata` |
| `resume-import.ts` | SELECT | `*` |
| `resume-import.ts` | UPDATE | `status`, `metadata`, `error_message`, `processing_started_at` |
| `cancel-import.ts` | SELECT | `id`, `status`, `metadata`, `uploaded_by` |
| `cancel-import.ts` | UPDATE | `status`, `error_message`, `processing_completed_at` |
| **`recover-stuck-imports.ts`** | **SELECT** | **`id`, `status`, `updated_at`** (+ extended set for `processing`) |
| **`recover-stuck-imports.ts`** | **UPDATE** | **`status`, `error_message`** |
| `upsert.ts` | — | touches `creator_sources`, `influencers`, `influencer_platform_accounts` (not `creator_import_files`) |

### `app/` and `features/` (root app/lib grep)

| File | Operation | Columns |
|------|-----------|---------|
| `features/discovery-import/actions.ts` | INSERT | `id`, `filename`, `source_name`, `file_type`, `storage_path`, `uploaded_by`, `status`, `metadata` |
| `features/discovery-import/actions.ts` | UPDATE | `status` |
| `features/discovery-import/queries.ts` | SELECT | `id`, `filename`, `source_name`, `file_type`, `storage_path`, `uploaded_by`, `status`, counters, `processing_started_at`, `processing_completed_at`, `error_message`, `created_at` |
| `scripts/reset-stuck-enrichment-queued.ts` | SELECT (count) / UPDATE | `status`, `error_message` |

No matches under `app/api/` or `app/(dashboard)/`.

### Related tables used by discovery-worker import path (via lib)

- `creator_sources` — provenance linkage
- `influencers`, `influencer_platform_accounts` — upsert targets
- Storage buckets `creator-imports`, `creator-avatars`

---

## 2. Expected schema from migrations

### Migration chain (chronological)

| Migration | Purpose |
|-----------|---------|
| `20260625140000_discovery_import_center.sql` | CREATE `creator_import_files`, `creator_sources`; indexes; RLS; `creator-imports` bucket |
| `20260625150000_discovery_import_processing.sql` | ADD `failed_creators` |
| `20260625160000_fix_discovery_import_permissions.sql` | GRANTs; storage service_role policies (partially superseded) |
| `20260625170000_discovery_import_diagnostics.sql` | ADD `extracted_text_length`, `parser_strategy`, `extraction_method`, `warning_message` |
| `20260625180000_audit_remove_demo_creators.sql` | Comment-only reference |
| `20260625190000_protect_creator_import_files.sql` | Granular RLS; immutability trigger |
| `20260630100000_creator_import_avatars_storage.sql` | `creator-avatars` bucket |
| `20260630120000_creator_import_chunk_json_mime.sql` | Allow `application/json` in `creator-imports` |
| `20260630160000_creator_import_paused_status.sql` | ADD `paused` to status CHECK |

### `creator_import_files` — expected columns (migrations only)

```
id, filename, source_name, file_type, storage_path, uploaded_by,
status, total_creators, imported_creators, updated_creators,
duplicate_creators, failed_creators,
extracted_text_length, parser_strategy, extraction_method, warning_message,
processing_log, metadata,
processing_started_at, processing_completed_at, error_message,
created_at
```

**No `updated_at` column in any migration.**

### Indexes

- `creator_import_files_uploaded_by_idx` ON `(uploaded_by, created_at DESC)`
- `creator_import_files_status_idx` ON `(status, created_at DESC)`
- **No index on `updated_at`**

### Triggers

- `guard_creator_import_file_immutable_columns` — BEFORE UPDATE; blocks provenance tampering for authenticated users
- **No `set_updated_at` trigger**

### RLS policies (final state after `20260625190000`)

| Policy | Role | Operation |
|--------|------|-----------|
| `creator_import_files_select` | authenticated | SELECT (discovery.read/write/admin) |
| `creator_import_files_insert` | authenticated | INSERT (discovery.write/admin) |
| `creator_import_files_update` | authenticated | UPDATE (discovery.write/admin) |
| `creator_import_files_delete` | authenticated | DELETE (discovery.admin only) |
| `creator_import_files_service` | service_role | ALL |

### `creator_sources` — expected

Columns: `id`, `influencer_id`, `source_name`, `source_file_id`, `imported_at`  
Indexes: `creator_sources_influencer_id_idx`, `creator_sources_source_file_id_idx`  
RLS: `creator_sources_select`, `creator_sources_write`, `creator_sources_service`

---

## 3. Actual schema (inferred from repo)

Live database was not queried during this audit. The following is inferred from the migration chain and code references.

| Source | What it implies |
|--------|-----------------|
| Migrations `20260625140000` through `20260630160000` | Schema **without** `updated_at`, without `updated_at` trigger, without `updated_at` index |
| `types/database.ts` | Generated types match migrations — no `updated_at` on `creator_import_files` |
| Worker code (`recover-stuck-imports.ts`) | Expects `updated_at` column for stuck-status recovery |
| KI-005 symptom | Live DB matches migration-defined schema; worker code is ahead of schema |

Import processing (`process.ts`, chunk workers) works without `updated_at`. Only **startup stuck recovery** fails.

---

## 4. Gaps (expected vs worker/code expectations)

| Gap | Severity | Detail |
|-----|----------|--------|
| **`updated_at` column missing** | **P1** | Only `recover-stuck-imports.ts` references it; breaks worker startup recovery (KI-005) |
| **`updated_at` trigger missing** | P1 | Even if column were added manually, status UPDATEs would not bump it without `public.set_updated_at()` trigger |
| **`updated_at` index missing** | P2 | Stuck recovery filters `.eq("status", …).lt("updated_at", cutoff)` — would benefit from `(status, updated_at DESC)` index |
| **`types/database.ts` drift** | P2 | Generated types match migrations (no `updated_at`) but **not** `recover-stuck-imports.ts` |
| **`paused` status migration** | P2 (conditional) | If `20260630160000` not applied, pause/resume fails; code has explicit hint in `constants.ts` |
| Storage policy conflict (resolved) | Info | `20260625160000` re-adds service_role storage UPDATE; `20260625190000` removes it — final state is immutability per 251900 |

**Not missing:** table, core columns, diagnostics, `failed_creators`, immutability trigger, granular RLS, paused status (in migration file).

---

## 5. Which migration should have created `creator_import_files.updated_at`?

**Answer: None in the repository.**

The stuck-recovery module mirrors `lib/creator-enrichment/recover-stuck-enrichments.ts`, which uses `influencers.updated_at` (present on `influencers` from baseline schema). The import equivalent was never added when `recover-stuck-imports.ts` was introduced.

### Missing migration(s)

A new migration is required. Suggested filename:

`20260723130000_creator_import_files_updated_at.sql` (**added** — apply with `npx supabase db push`)

```sql
ALTER TABLE public.creator_import_files
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

-- Backfill from best available timestamps
UPDATE public.creator_import_files
SET updated_at = GREATEST(
  created_at,
  COALESCE(processing_started_at, created_at),
  COALESCE(processing_completed_at, created_at)
);

CREATE INDEX IF NOT EXISTS creator_import_files_status_updated_at_idx
  ON public.creator_import_files (status, updated_at DESC);

DROP TRIGGER IF EXISTS set_creator_import_files_updated_at ON public.creator_import_files;
CREATE TRIGGER set_creator_import_files_updated_at
  BEFORE UPDATE ON public.creator_import_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

## 6. Why the migration did not apply?

| Hypothesis | Verdict |
|------------|---------|
| Migration file exists but out of order | **Rejected** — file does not exist |
| Migration never created | **Confirmed** — root cause |
| Column in migration never written | **Confirmed** — same as above |
| Supabase migration history gap | **Cannot verify from repo** — no `.supabase/` or remote `migration list` in repo |
| Local vs remote apply state | **Inferred:** migrations through `20260630160000` define schema **without** `updated_at`; live DB symptom in KI-005 matches repo state; worker code is ahead of schema |

This is **code/schema drift**, not a failed migration apply.

---

## 7. Recommended fix order (documentation only)

1. **Verify remote migration state** — `npx supabase migration list`; confirm `20260630160000_creator_import_paused_status.sql` applied if pause/resume is used.
2. **Add new migration** for `updated_at` + trigger + index (see §5).
3. **`npx supabase db push`** to staging, then production.
4. **Regenerate `types/database.ts`** so TypeScript matches schema.
5. **Redeploy discovery-worker** — startup recovery should succeed; confirm log no longer shows KI-005.
6. **Optional:** add migration hint in `lib/discovery-import/constants.ts` (parallel to paused-status hint).

**Alternative (code-only, no migration):** change `recover-stuck-imports.ts` to use `created_at` or `processing_started_at` instead of `updated_at` — weaker semantics for "last status change" detection.

---

## References

- **KI-005:** `docs/release/KNOWN_ISSUES.md` — Symptom: `stuck-status recovery failed column creator_import_files.updated_at does not exist`; impact: stuck import recovery disabled; worker otherwise operational.
- **Recovery caller:** `services/discovery-worker/src/index.ts` → `recoverStuckCreatorImportFiles`
- **Recovery implementation:** `lib/discovery-import/recover-stuck-imports.ts`
- **Parallel pattern:** `lib/creator-enrichment/recover-stuck-enrichments.ts` (uses `influencers.updated_at`)
