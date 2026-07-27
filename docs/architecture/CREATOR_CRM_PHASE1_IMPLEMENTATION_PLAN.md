# Creator CRM — Phase 1 Implementation Plan

**Status:** Ready to execute (no Production workflow wiring in this phase)  
**Date:** 2026-07-27  
**Parent:** `CREATOR_CRM_FINAL_ARCHITECTURE.md` (decisions locked)  
**Branch context:** implement on `develop` unless release process says otherwise  

---

## 1. Phase 1 goals

Deliver **additive schema + types + feature-flag contract + service interface** so later phases can activate CRM safely.

| In scope | Out of scope |
|---|---|
| Enums, tables, indexes, triggers | Wiring `ensureCommercialCreator` into campaigns/quotes |
| RLS policies on new tables | Renaming Vendors UI / `/creators` routes |
| `has_commercial_profile` denorm on `influencers` | Backfill migration (Phase 3) |
| TypeScript types for new tables/RPCs | Completeness engine implementation |
| Feature flag constant + docs | Apify rename (Phase 2 — document dependency) |
| Unit/SQL validation of schema | DNA staging promote (Phase 2b) |
| Stub module exporting `ensureCommercialCreator` signature + permission helpers (may throw “not wired” or implement insert-only against new tables for tests) | Production cutover |

**Success criteria:** New tables exist on Dev (and optionally Prod as additive DDL); app builds; flag OFF leaves current Vendors behavior unchanged; no CRM filter applied yet.

---

## 2. Locked decisions that constrain Phase 1

| Decision | Implication for Phase 1 |
|---|---|
| Flag OFF = legacy Vendors list | Flag default **false**; no list query changes that break OFF path |
| `/creators` canonical later | Phase 1: only document; optional empty route stub **not required** |
| Convert = AM / Ops / Admin | Schema comment + permission helper stub listing allowed role slugs |
| No auto Incomplete→Active | No DB trigger advancing `crm_status` on VIO |
| No draft-quote backfill | Phase 1 ships **empty** CRM tables; backfill SQL designed in Phase 3 using operational signals only |
| Quote activates only when operational | No quotation hooks in Phase 1 |

---

## 3. Schema design (DDL sketch)

Migration filename (suggested):  
`supabase/migrations/20260727040000_creator_crm_profiles.sql`

### 3.1 Enums

```sql
CREATE TYPE public.creator_crm_status AS ENUM (
  'incomplete',
  'prospect',
  'negotiating',
  'active',
  'preferred',
  'inactive',
  'do_not_use'
);

CREATE TYPE public.creator_crm_activation_reason AS ENUM (
  'manual_convert',
  'manual_create',
  'campaign_assignment',
  'quotation_operational',
  'vendor_io',
  'portal_invite',
  'payment_details',
  'finance_document',
  'backfill',
  'other'
);
```

### 3.2 `creator_crm_profiles`

```sql
CREATE TABLE public.creator_crm_profiles (
  influencer_id uuid PRIMARY KEY
    REFERENCES public.influencers (id) ON DELETE CASCADE,
  crm_status public.creator_crm_status NOT NULL DEFAULT 'incomplete',
  activated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  activated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  activated_reason public.creator_crm_activation_reason NOT NULL,
  completeness_score numeric(5, 2) NOT NULL DEFAULT 0
    CHECK (completeness_score >= 0 AND completeness_score <= 100),
  completeness_missing jsonb NOT NULL DEFAULT '[]'::jsonb,
  completeness_updated_at timestamptz,
  -- Future-ready (nullable)
  managed_by_agency_id uuid REFERENCES public.agencies (id) ON DELETE SET NULL,
  commercial_owner_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  preferred_currency char(3),
  onboarding_source text,
  negotiation_notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX creator_crm_profiles_status_activated_idx
  ON public.creator_crm_profiles (crm_status, activated_at DESC);

CREATE INDEX creator_crm_profiles_activated_at_idx
  ON public.creator_crm_profiles (activated_at DESC);
```

### 3.3 `creator_crm_activation_events` (audit)

```sql
CREATE TABLE public.creator_crm_activation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL
    REFERENCES public.influencers (id) ON DELETE CASCADE,
  reason public.creator_crm_activation_reason NOT NULL,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  source_entity_type text,
  source_entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX creator_crm_activation_events_influencer_idx
  ON public.creator_crm_activation_events (influencer_id, created_at DESC);

-- Dedupe repeated backfill/ops noise for same source
CREATE UNIQUE INDEX creator_crm_activation_events_source_uidx
  ON public.creator_crm_activation_events (
    influencer_id,
    reason,
    source_entity_type,
    source_entity_id
  )
  WHERE source_entity_id IS NOT NULL;
```

### 3.4 Denorm on `influencers`

```sql
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS has_commercial_profile boolean NOT NULL DEFAULT false;

CREATE INDEX influencers_has_commercial_profile_created_at_idx
  ON public.influencers (created_at DESC)
  WHERE has_commercial_profile = true;

CREATE OR REPLACE FUNCTION public.sync_influencer_has_commercial_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.influencers
    SET has_commercial_profile = true
    WHERE id = NEW.influencer_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.influencers
    SET has_commercial_profile = false
    WHERE id = OLD.influencer_id
      AND NOT EXISTS (
        SELECT 1 FROM public.creator_crm_profiles p
        WHERE p.influencer_id = OLD.influencer_id
      );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_has_commercial_profile
  AFTER INSERT OR DELETE ON public.creator_crm_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_influencer_has_commercial_profile();
```

Also attach `set_updated_at` trigger on `creator_crm_profiles` (reuse existing pattern).

### 3.5 RLS (Phase 1)

Mirror influencers access model without widening Discovery:

```sql
ALTER TABLE public.creator_crm_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_crm_activation_events ENABLE ROW LEVEL SECURITY;

-- SELECT: influencers.read + can_access_influencer(influencer_id)
-- INSERT/UPDATE: influencers.write + (is_internal_user OR can_access)
-- DELETE: admin / influencers.delete (profiles rarely deleted; cascade from influencer)
```

Do **not** put Convert role matrix in RLS in Phase 1 (enforce in app in Phase 2). RLS only ensures authenticated commercial staff with influencer access can read/write rows.

### 3.6 Grants

```sql
GRANT SELECT, INSERT, UPDATE ON public.creator_crm_profiles TO authenticated;
GRANT SELECT, INSERT ON public.creator_crm_activation_events TO authenticated;
-- no UPDATE/DELETE on events for authenticated (append-only)
```

### 3.7 Optional RPC stub (Phase 1 optional)

Defer `creator_crm_list_total_count` to Phase 5 when list filter lands. Phase 1 may add empty placeholder comment in migration header.

---

## 4. Application / types (Phase 1)

| File / area | Change |
|---|---|
| `types/database.ts` | Add enum types, table Row/Insert/Update, Relationships |
| `lib/creators/crm/types.ts` (new) | `CreatorCrmStatus`, `CrmActivationReason`, profile DTO |
| `lib/creators/crm/feature-flag.ts` (new) | `isCreatorCrmFilterEnabled()` reading `CREATOR_CRM_FILTER_ENABLED` / `NEXT_PUBLIC_…` default **false** |
| `lib/creators/crm/permissions.ts` (new) | `canConvertToCommercialCreator(roleSlug)` → true for `account_manager`, `operations`, `admin`, `super_admin`; false for `finance` and others |
| `lib/creators/crm/ensure-commercial-creator.ts` (new) | Full idempotent insert implementation against new tables **or** stub used only by unit tests — **must not be called from campaign/quote paths yet** |
| `docs/architecture/…` | Keep in sync |
| `features/vendors/queries.ts` | **No behavior change** while flag OFF |

### 4.1 `ensureCommercialCreator` contract (Phase 1)

```ts
export type EnsureCommercialCreatorInput = {
  influencerId: string;
  reason: CreatorCrmActivationReason;
  actorId: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  initialStatus?: CreatorCrmStatus; // default 'incomplete'
  metadata?: Record<string, unknown>;
};

export type EnsureCommercialCreatorResult = {
  influencerId: string;
  created: boolean;
  crmStatus: CreatorCrmStatus;
  eventId: string | null;
};
```

Behavior Phase 1:

1. If profile exists → return `{ created: false }`; optionally insert event if new source unique.  
2. If missing → insert profile (`incomplete` unless specified) + activation event; trigger sets `has_commercial_profile`.  
3. No status auto-advance logic.  
4. Permission checks for **manual** reasons (`manual_convert`, `manual_create`) via `canConvertToCommercialCreator`; system reasons may run from service role / trusted server paths in later phases.

---

## 5. Migration order

1. **Dev first** — `scripts/psql-development.mjs -f …` (or `supabase db push` if linked safely).  
2. Run Phase 1 validation suite (§7).  
3. **Prod additive apply** only after Dev green — same SQL file via `psql-production.mjs`.  
4. `NOTIFY pgrst, 'reload schema'`.  
5. Merge types/flag/module on `develop`; deploy Dev app with flag **OFF**.  
6. **Do not** enable flag or backfill in Phase 1.

---

## 6. Services boundary (prepare for Phase 2)

Document call-site map (implement wiring later):

| Caller (future) | reason |
|---|---|
| Convert action | `manual_convert` |
| New commercial create | `manual_create` |
| `campaign_influencers` insert | `campaign_assignment` |
| Quotation → campaign operationalize | `quotation_operational` |
| Vendor IO create | `vendor_io` |
| Portal invite | `portal_invite` |
| Backfill job | `backfill` |

**Must not call (ever):** import, Apify, shortlist add, identity promote alone, draft quotation sync.

**Phase 2 prerequisite:** rename `ensureCommercialCreatorFromApifyData` → identity-named helper.

---

## 7. Validation plan

### 7.1 SQL checks (Dev + Prod after DDL)

```sql
-- tables/enums exist
SELECT typname FROM pg_type WHERE typname IN ('creator_crm_status', 'creator_crm_activation_reason');
SELECT to_regclass('public.creator_crm_profiles');
SELECT to_regclass('public.creator_crm_activation_events');

-- column + index
SELECT column_name FROM information_schema.columns
WHERE table_name = 'influencers' AND column_name = 'has_commercial_profile';

-- trigger fires
-- (in transaction) insert test profile → influencers.has_commercial_profile = true → rollback
```

### 7.2 App checks

- `npx tsc --noEmit`  
- `npm run build`  
- Flag OFF: `/vendors` still lists all influencers (manual smoke on Dev)  
- Unit test: `ensureCommercialCreator` idempotent (insert twice → one profile, two events only if distinct sources)

### 7.3 Performance sanity

```sql
EXPLAIN (ANALYZE) SELECT COUNT(*) FROM creator_crm_profiles; -- empty → trivial
```

### 7.4 Security sanity

- Authenticated without `influencers.read` cannot SELECT CRM profiles (RLS).  
- Events table: no UPDATE policy for authenticated.

---

## 8. Risks & rollback

| Risk | Mitigation |
|---|---|
| Locking `influencers` on ADD COLUMN | `ADD COLUMN … DEFAULT false` is fast on PG 11+; run in maintenance window if needed |
| Accidental flag ON in env | Default false; document in `.env.example` |
| Premature call sites | Code review gate: no imports of ensure from campaigns until Phase 6 |
| RLS too strict for later backfill | Backfill uses service role / SECURITY DEFINER job in Phase 3 |

**Rollback Phase 1**

```sql
DROP TRIGGER IF EXISTS trg_sync_has_commercial_profile ON public.creator_crm_profiles;
DROP FUNCTION IF EXISTS public.sync_influencer_has_commercial_profile();
DROP TABLE IF EXISTS public.creator_crm_activation_events;
DROP TABLE IF EXISTS public.creator_crm_profiles;
DROP TYPE IF EXISTS public.creator_crm_activation_reason;
DROP TYPE IF EXISTS public.creator_crm_status;
ALTER TABLE public.influencers DROP COLUMN IF EXISTS has_commercial_profile;
```

App: revert types/module; flag unused.

---

## 9. Deliverables checklist

- [x] Migration SQL committed  
- [x] Applied on Development  
- [x] Applied on Production (additive, empty tables)  
- [x] Types + CRM module + flag + permission helper  
- [x] Schema / idempotency tests green  
- [x] Flag OFF confirmed — Vendors unchanged  
- [x] Phase 1 sign-off note in `docs/architecture/` or release log  

---

## 10. Explicit non-goals reminder

Phase 1 does **not**:

- Filter Vendors/Creators list  
- Redirect `/vendors` → `/creators`  
- Backfill commercial creators  
- Wire quotation/assignment/VIO  
- Auto-advance CRM status  
- Implement completeness scoring UI  

Those begin Phase 2+.
