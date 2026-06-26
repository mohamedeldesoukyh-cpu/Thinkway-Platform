# Discovery Import Center — Phase 2 Processing Pipeline

**Status:** Phase 2 complete (upload → queue → worker → upsert → enrichment)  
**Route:** `/discovery/import`  
**Migrations:**
- `supabase/migrations/20260625140000_discovery_import_center.sql` (Phase 1)
- `supabase/migrations/20260625150000_discovery_import_processing.sql` (failed counter)
- `supabase/migrations/20260625190000_protect_creator_import_files.sql` (file immutability / protection)

## Purpose

Bulk-import creator datasets (agency exports, platform lists, client spreadsheets) into Thinkway vendors (`influencers` + `influencer_platform_accounts`) with provenance tracking (`creator_sources`), duplicate detection, audit trail, and post-import enrichment.

## Architecture

```
User → Import Center UI
     → uploadCreatorImportFileAction
     → Supabase Storage `creator-imports`
     → creator_import_files (status: uploaded → queued)
     → BullMQ `creator-import` queue
     → discovery-worker / creator-import.worker
         → download file
         → parse (PDF / CSV / XLSX)
         → normalize rows
         → upsert influencers + platform accounts
         → write creator_sources + audit_logs
         → enqueue `creator-import-enrich` per account
     → creator-import-enrich.worker
         → open-graph enrichment (+ Apify avatar when configured)
     → creator_import_files (status: completed | failed)
```

## Status lifecycle

| Status | Meaning |
|--------|---------|
| `uploaded` | File stored; queue not configured or not yet enqueued |
| `queued` | BullMQ job created |
| `processing` | Worker parsing and upserting |
| `completed` | Counters and `processing_log` populated |
| `failed` | Fatal parse/process error (`error_message` set) |

## Supported file types

| Type | Parser | Notes |
|------|--------|-------|
| PDF | `pdf-parse` v2 + two indaHash strategies | (1) structured `@handle` rows; (2) `indahash-pdf-search` for the real web "Creator Search" export (flattened table, no `@`, scattered metrics). Falls through to `pdf-empty-text` (OCR candidate) or `pdf-unrecognized` |
| CSV | Header-mapped tabular parser | indaHash + generic column aliases |
| XLSX | `xlsx` sheet parser | First worksheet |
| ZIP | — | **Deferred** (Phase 3) |

### Extraction diagnostics

Every upload records why it produced the creator count it did, on `creator_import_files`:

| Column | Meaning |
|--------|---------|
| `extracted_text_length` | Characters returned by text extraction (`< 100` ⇒ likely scanned/image PDF) |
| `parser_strategy` | Which parser matched (`indahash-pdf`, `indahash-pdf-search`, `pdf-empty-text`, `pdf-unrecognized`, `*-csv`, `*-xlsx`) |
| `extraction_method` | `text` or `ocr` |
| `warning_message` | Human-readable reason for a zero/low creator count |

## Normalized creator shape

Each parsed row maps to:

```
username, platform, followers, engagement_rate, country,
source, categories, audience_interests, relevance_score
```

- `categories` → `influencers.categories`
- `audience_interests` + `relevance_score` → `influencer_platform_accounts.metadata`
- `country` → `influencers.country_code` (ISO-2 when recognized)

## Duplicate prevention

Matching uses `influencer_platform_accounts.normalized_username` + `platform` (unique partial index from Phase 1).

| Outcome | Counter |
|---------|---------|
| New influencer + account | `imported_creators` |
| Existing account updated | `updated_creators` |
| Unique constraint race / duplicate handle | `duplicate_creators` |
| Row-level upsert error | `failed_creators` |

## Queues (BullMQ)

| Queue | Producer | Consumer |
|-------|----------|----------|
| `creator-import` | `lib/discovery-import/queue.ts` | `services/discovery-worker` → `creator-import.worker.ts` |
| `creator-import-enrich` | `lib/discovery-import/enrichment.ts` | `creator-import-enrich.worker.ts` |

Requires `REDIS_URL`. Upload action sets status `queued` when enqueue succeeds.

## Run worker locally

1. Apply migrations (`supabase db push` or dashboard).
2. Set env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`.
3. Optional enrichment: `APIFY_TOKEN` (+ actor IDs for avatar sync).
4. Start Redis (local or cloud).
5. From repo root:

```bash
npm run discovery:worker
```

Dev watch mode:

```bash
npm run discovery:worker:dev
```

On Windows, scripts set `NODE_OPTIONS=--use-system-ca` for TLS.

## Tests

```bash
npx tsx lib/discovery-import/parsers/indahash.test.ts
```

indaHash nano export regression: **1,823 creators** from synthetic fixture matching export line format.

## UI

Import History table columns: filename, source, status, file type, total / imported / updated / failed creators, created date.

## Permissions

Unchanged from Phase 1 (`discovery.read` / `discovery.write` / `discovery.admin`). Workers use `service_role`.

## File protection / immutability

Uploaded import source files (PDF / CSV / XLSX / ZIP) are an **immutable audit / source-of-truth record**. Once stored they cannot be edited, overwritten, or deleted by users. Enforced by `supabase/migrations/20260625190000_protect_creator_import_files.sql`.

### What "protected/immutable" means

- **Storage bytes** in the private `creator-imports` bucket can never be overwritten (no `UPDATE`) by anyone — not even the backend. The uuid-prefixed path (`{user_id}/{import_id}/{uuid}-{filename}`) plus `upsert: false` means every upload is a fresh object; there is no path to replace existing bytes.
- **DB provenance columns** on `creator_import_files` (`filename`, `storage_path`, `file_type`, `uploaded_by`, `created_at`) cannot be changed by any authenticated session — a `BEFORE UPDATE` trigger raises `42501`.
- **Deletion** of the storage object is denied for all authenticated users. Deletion of the DB row is **admin-only** (`discovery.admin`).
- The worker can still download files and update **processing/diagnostic columns** (`status`, counters, `processing_log`, `processing_started_at`, `processing_completed_at`, `error_message`, `parser_strategy`, `extracted_text_length`, `extraction_method`, `warning_message`).

### Role × action matrix

**Storage object** (bucket `creator-imports`):

| Role | Read (SELECT) | Upload (INSERT) | Overwrite (UPDATE) | Delete (DELETE) |
|------|:--:|:--:|:--:|:--:|
| Authenticated (`discovery.*`) | yes | yes (write/admin) | **no** | **no** |
| `service_role` (worker / admin) | yes | yes | **no** | yes¹ |

**DB row** (`creator_import_files`):

| Role | Read | Insert | Update provenance² | Update processing | Delete |
|------|:--:|:--:|:--:|:--:|:--:|
| Authenticated (`discovery.write`) | yes | yes | **no** | yes | **no** |
| Authenticated (`discovery.admin`) | yes | yes | **no** | yes | yes |
| `service_role` | yes | yes | yes³ | yes | yes |

¹ `service_role` delete is retained **only** as a documented escape hatch: legal/GDPR purge and best-effort cleanup of an orphaned object when an upload's DB insert fails (run via `createSupabaseAdminClient`, never user UI). There is intentionally no `service_role` overwrite (`UPDATE`) policy, so stored bytes are immutable for everyone.

² Provenance = `filename`, `storage_path`, `file_type`, `uploaded_by`, `created_at`.

³ `service_role` bypasses the immutability trigger (`auth.uid()` is `NULL` for backend sessions) so records can be corrected administratively if ever required.

### Can anything still delete?

Yes — by design, two narrow paths remain: a **`discovery.admin`** user may delete the DB row, and **`service_role`** may delete both the row and the storage object. These exist for legal/GDPR purge and failed-upload orphan cleanup. Normal users and even `discovery.write` users cannot delete or overwrite anything.

## Deferred (Phase 3+)

- ZIP archive extraction (multi-file bundles)
- OCR for scanned PDFs
- AI-assisted column mapping for unknown spreadsheets
- Import detail sheet with log viewer and retry
- Signed download URLs for original files
- Dedicated Apify profile-scraper actor (current enrich path: open-graph + optional Apify avatar)

## Related docs

- `docs/DISCOVERY_ENGINE.md` — public-signal discovery crawlers
- `docs/THINKWAY_SYSTEM_REFERENCE.md` — vendor hierarchy
