# Database Overview

**Engine:** Supabase PostgreSQL  
**Migrations:** `supabase/migrations/` (~185 SQL files, `YYYYMMDDHHMMSS_*.sql`)  
**Types:** `types/database.ts` (regenerate from Development after schema changes)

## Core hierarchy tables

`groups` → `clients` → `brands` → `campaign_headers` → `campaign_lines` (+ `campaign_influencers`, deliverables, finance)

## Creator stack

| Area | Tables (representative) |
|---|---|
| Identity | `influencers`, platform accounts |
| Discovery | `discovery_*`, `creator_import_files`, enrichment runs |
| DNA | `creator_dna*`, staging |
| Commercial CRM | `creator_crm_profiles`, `creator_crm_activation_events` |
| Intelligence | `creator_intelligence` (+ related) |

## RLS posture (recent)

- Finance / FX: least-privilege + FORCE RLS (Jul 2026)
- Creator intelligence: least-privilege validated Dev + Prod
- CRM profiles: permission + `can_access_influencer`; activation events append-only for authenticated
- Service-role policies for workers are expected — protect the key

## Indexes / health

- Prefer **additive** indexes validated with EXPLAIN on Development
- Vendor list / browse RPCs have dedicated hotfixes — do not drop without evidence
- Orphan cleanup is operational (scripts), not silent Production deletes

## Known gaps (non-destructive)

| Gap | Severity | Action |
|---|---|---|
| `types/database.ts` may omit some discovery control/coverage tables | Medium | Regenerate types from Dev |
| Handover schema doc migration count may lag | Low | Refresh on doc passes |
| Few paired rollbacks vs forward migrations | Low | Keep CRM-style rollbacks for high-risk features |

## Related

- `docs/handover/04_DATABASE_SCHEMA.md`
- `docs/PERFORMANCE_GOVERNANCE.md`
- CRM: `supabase/migrations/20260727040000_creator_crm_profiles.sql`
- Rollback: `supabase/rollbacks/20260727040000_creator_crm_profiles_rollback.sql`
