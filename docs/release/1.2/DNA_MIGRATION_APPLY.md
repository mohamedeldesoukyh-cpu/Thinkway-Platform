# Release 1.2 — DNA & Discovery migration apply guide

Discovery search works **without** these migrations (completeness is computed from `creator_dna.document` JSON at hydration time; coverage audit writes are skipped when the audit table is missing). Apply the migrations below to enable cached completeness scores and coverage audit persistence.

## Prerequisites

- Supabase CLI linked to your project (`supabase link`)
- Operator approval for schema changes on the target environment

## Apply all pending migrations

```bash
npx supabase db push
```

## Or apply individually

### Phase 1 — Discovery coverage audit (optional for search; required for audit trail)

```bash
# File: supabase/migrations/20260705100000_discovery_coverage_decisions.sql
npx supabase db push
# or run the SQL file manually in Supabase SQL Editor
```

Creates `discovery_coverage_decisions` — records DB vs Apify coverage decisions per search.

### Phase 2 — Creator DNA cached completeness score (optional for search; required for write-path cache)

```bash
# File: supabase/migrations/20260705120000_creator_dna_phase2_extensions.sql
npx supabase db push
# or run the SQL file manually in Supabase SQL Editor
```

Adds `dna_completeness_score` to `creator_dna` and `creator_dna_staging`. Browse/hydration no longer depends on this column; it is used when merging DNA evidence via `creator-dna-service`.

## Verify

After push, confirm columns/table exist:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'creator_dna'
  AND column_name = 'dna_completeness_score';

SELECT to_regclass('public.discovery_coverage_decisions');
```

## Rollback note

Both migrations are additive (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). No Release 1.1 tables or columns are modified destructively.
