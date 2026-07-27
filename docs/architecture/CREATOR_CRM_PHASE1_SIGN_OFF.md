# Creator CRM — Phase 1 Sign-off

**Date:** 2026-07-27  
**Branch:** `develop`  
**Status:** **CLOSED** — reviewed and approved; milestone `creator-crm-phase-1-foundation`  
**Milestone:** [CREATOR_CRM_PHASE1_MILESTONE.md](./CREATOR_CRM_PHASE1_MILESTONE.md)  

---

## 1. Migration summary

| Item | Detail |
|---|---|
| Migration | `supabase/migrations/20260727040000_creator_crm_profiles.sql` |
| Rollback | `supabase/rollbacks/20260727040000_creator_crm_profiles_rollback.sql` |
| Validation | `scripts/validate-creator-crm-phase1.sql` (`npm run validate:creator-crm-phase1`) |
| Dev (`hsxrewjcbvmbkqdlzjhs`) | Applied + validated |
| Prod (`ienowhwfyxoqtzbgltno`) | Applied + validated |
| PostgREST | `NOTIFY pgrst, 'reload schema'` on Dev and Prod |
| Rows | `creator_crm_profiles` = 0, `has_commercial_profile` = false for all (no backfill) |

---

## 2. Database schema changes

**Enums**

- `creator_crm_status`: incomplete, prospect, negotiating, active, preferred, inactive, do_not_use  
- `creator_crm_activation_reason`: manual_convert, manual_create, campaign_assignment, quotation_operational, vendor_io, portal_invite, payment_details, finance_document, backfill, other  

**Tables**

- `creator_crm_profiles` (PK = `influencer_id` → influencers CASCADE)  
- `creator_crm_activation_events` (append-only audit; unique on influencer+reason+source when source_entity_id present)  

**Column / trigger**

- `influencers.has_commercial_profile boolean NOT NULL DEFAULT false`  
- `sync_influencer_has_commercial_profile` AFTER INSERT/DELETE on profiles  
- Partial index `influencers_has_commercial_profile_created_at_idx` (for future CRM list)  
- `set_updated_at` on CRM profiles  

---

## 3. RLS review

| Object | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `creator_crm_profiles` | `influencers.read` + `can_access_influencer` | write + internal + access | write + internal + access | `influencers.delete` + `is_admin` |
| `creator_crm_activation_events` | same as SELECT above | write + internal + access | **none** (append-only) | **none** |

- Convert-role matrix is **app-enforced** for manual reasons (not in RLS) — per locked Phase 1 design.  
- Policies mirrored in `supabase/policies.sql`.  
- Validation asserts no UPDATE/DELETE policies on activation events.

---

## 4. TypeScript / API changes

| Path | Role |
|---|---|
| `types/database.ts` | Enums, Row types, Tables entries, `has_commercial_profile` |
| `lib/creators/crm/ensure-commercial-creator.ts` | **Sole** CRM lifecycle entry (`ensureCommercialCreator`) |
| `lib/creators/crm/feature-flag.ts` | `isCreatorCrmFilterEnabled()` — default **false** |
| `lib/creators/crm/permissions.ts` | Convert roles: AM / Ops / Admin / Super Admin |
| `lib/creators/crm/types.ts` + `index.ts` | Public CRM surface |
| `lib/creators/identity/ensure-identity.ts` | Boundary stub only — no CRM writes |
| `.env.example` | Documents flag OFF |

**Not wired:** Discovery, Campaign, Quotation, Assignment, Vendor IO, Vendors queries/UI.

---

## 5. Test results

```
npm run test:creator-crm-phase1  → 16/16 pass
npm run validate:creator-crm-phase1 → creator_crm_phase1_validation_ok (Dev)
psql-production validate → creator_crm_phase1_validation_ok (Prod)
npx tsc --noEmit → exit 0
```

Coverage: flag default OFF, convert permissions, ensure idempotency / permissions / no identity invent, no CRM↔Discovery imports, no production call sites for `ensureCommercialCreator`.

---

## 6. Performance impact assessment

| Change | Impact |
|---|---|
| Empty CRM tables | Negligible; `COUNT(*)` seq scan on empty relation |
| `has_commercial_profile DEFAULT false` | Metadata-only ADD COLUMN (PG 11+); no rewrite observed |
| Sync trigger | Idle until CRM rows exist; no Vendors list join while flag OFF |
| Partial index | Unused until Phase 5 list filter |
| Vendors list path | Unchanged — no query/filter wiring |

---

## 7. Rollback strategy validation

Rollback SQL executed inside `BEGIN … ROLLBACK` on Dev:

- Objects dropped successfully inside the transaction  
- After `ROLLBACK`, `creator_crm_profiles` and `has_commercial_profile` restored  

Production rollback file ready; safe while flag OFF and tables empty / unused.

---

## 8. Feature flag & UX confirmation

- `isCreatorCrmFilterEnabled()` returns **false** when env unset  
- No `CREATOR_CRM_FILTER_ENABLED` / `NEXT_PUBLIC_…` required  
- `features/vendors` has **zero** references to CRM helpers or `has_commercial_profile`  
- Production user experience remains unchanged for Discovery, Campaigns, Quotations, Assignments, Vendor IO, Reporting, and Vendors UI  

---

## Phase 2 gate

Do **not** proceed to Phase 2 (Apify rename, wiring, DNA staging, UI filter, backfill) until this Phase 1 package is reviewed and approved.
