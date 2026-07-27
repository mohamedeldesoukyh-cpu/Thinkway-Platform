# Creator CRM Phase 2A — Development Soak Report

**Date:** 2026-07-27  
**Branch / commit:** `develop` @ `0edf8e0` (+ soak harness)  
**Environment:** Development Supabase `hsxrewjcbvmbkqdlzjhs`  
**Harness:** `npx tsx scripts/soak-creator-crm-phase2a.ts`  
**Status:** Soak complete — **Ready with conditions** for Phase 2B review (no implementation started)

---

## 1. Executive summary

Phase 2A Development soak validates that Identity → Discovery → (optional) Commercial boundaries hold under repeated promotion, that DNA staging promote is idempotent, and that the CRM writer gate blocks all commercial persistence while workflows remain unwired.

| Area | Result |
|---|---|
| Identity idempotency (Dev DB) | **PASS** |
| DNA staging → canonical | **PASS** |
| Writer gate OFF | **PASS** (0 CRM rows before/after) |
| Workflow wiring absent | **PASS** (static + runtime) |
| Discovery automated regression | **PASS** |
| Live worker/queue perf | **Not measured** (see §6) |
| Interactive Discovery UI E2E | **Not executed** (see conditions) |

**Recommendation: Ready with conditions** — approve Phase 2B planning only after accepting the conditions in §10.

---

## 2. Identity validation

Harness created an isolated Instagram soak creator, ran `promoteDiscoveredProfileToInfluencer` **3×**, then cleaned up.

| Check | Result |
|---|---|
| First promote creates identity | `created=true` |
| Repeats return same influencer id | Stable UUID across 3 runs |
| Repeat `created` flag | `true,false,false` |
| Influencer rows | **1** |
| Platform accounts for handle | **1** |
| Canonical DNA rows | **1** |
| CRM activation events | **0** |

**Observations**

- Repeated promotion is a functional no-op for identity creation (same `influencerId`).  
- Linked-path promotes still invoke baseline DNA (`requireCreatorBaselineDna`) — expected pre-existing behaviour; does not create a second influencer.  
- Discovery profile remains linked to the single identity (`discovered_profiles.influencer_id`).

---

## 3. DNA validation

| Check | Result |
|---|---|
| Staging marked promoted once | `promoted_to_influencer_id` + `promoted_at` set |
| Extra `promoteStaging` ×3 | `promoted=false` — “already promoted” |
| Canonical DNA | Single row |
| `creator_dna_versions` after 3 promotes + 3 staging calls | **2** (bounded; staging merge + baseline) |
| Orphan DNA (no influencer) | **0** (SQL invariant) |

**Observations**

- Staging → promote → canonical path works.  
- No duplicate staging promotions.  
- Version growth stayed small (2); not unbounded on repeat.  
- Completeness recalculation is implicit in merge/baseline; no evidence of runaway writes.

---

## 4. Writer gate validation

Forced `CREATOR_CRM_WRITERS_ENABLED=false` in harness.

| Check | Result |
|---|---|
| Effective writers flag | `false` |
| `ensureCommercialCreator` ×3 | `writersDisabled=true`, `created=false`, `eventId=null` |
| Dual-event helper (quote+assignment) | No event IDs; `writersDisabled=true` |
| `creator_crm_profiles` for soak id | **0** |
| `creator_crm_activation_events` for soak id | **0** |
| Global CRM counts before/after | **0 / 0** |
| `has_commercial_profile` | `false` |

**Static wiring (Campaign / Quotation / Assignment / Vendor IO)**

- No production imports of `@/lib/creators/crm` outside `lib/creators/crm` and the soak script.  
- Boundary tests: no `ensureCommercialCreator` call sites in `lib/features/app` outside CRM package.  
- Therefore quotations, campaigns, assignments, and Vendor IO **cannot** activate creators in this build.

**Note:** Fresh CRM tables initially lacked explicit `service_role` GRANTs for PostgREST; applied on Dev/Prod during soak and captured in migration `20260727041000_creator_crm_service_role_grants.sql`. Writer-gate logic itself does not depend on those grants.

---

## 5. Discovery regression results

Automated suites (no UI behaviour changes expected from Phase 2A):

| Suite | Result |
|---|---|
| `test:creator-crm-phase2a` | 25/25 pass |
| `test:discovery-ui-contract` | pass |
| `test:discovery-shortlist` | pass |
| `test:discovery-browse-id-stage` | pass |
| `test:discovery-unified-browse-tags` | pass |
| `dna-browse-hydration.test.ts` | pass |
| `discovery-import/upsert.test.ts` | pass |
| `discovery-browse-eligibility.test.ts` | pass |

**Not covered in this soak (conditions):** interactive Discovery Search / AI Search / Campaign Studio / live Apify import / live metrics worker UI in browser.

Code review confirms Phase 2A only touches promote DNA merge + identity rename + CRM plumbing with writers OFF — no Discovery ranking/filter/UI changes.

---

## 6. Performance comparison

Harness timings (Development, single soak creator):

| Operation | Samples (ms) | Average |
|---|---|---|
| Promote #1 (create + staging + baseline) | 2006 | — |
| Promote #2 / #3 (linked path) | 901 / 978 | ~940 |
| `promoteStaging` noop | 84 / 85 / 82 | **84** |
| `ensureCommercialCreator` (gate OFF) | 0.71 / 0.03 / 0.02 | **~0.25** |
| Dual-event helper (gate OFF) | 0.44 | **0.44** |

**Baseline:** No formal Phase 2A perf baseline file existed. Relative assessment:

- Writer-gated CRM path is negligible.  
- Staging idempotent path is cheap (~85 ms).  
- Linked promote still ~0.9–1.0 s due to baseline DNA — **pre-existing cost**, not CRM wiring.  
- **Worker latency / memory / queue throughput:** not measured (no Discovery worker soak run in this session).

**Regression verdict:** No measurable CRM-induced regression; promote latency dominated by existing DNA baseline work.

---

## 7. Architecture verification

Validated invariant:

```
Identity  →  Discovery  →  Commercial (optional, gated OFF)
```

| Forbidden path | Evidence |
|---|---|
| Commercial → Identity | CRM ensure never creates influencers (unit + soak) |
| DNA → Commercial → Identity | `promoteStaging` / baseline do not call CRM; writers OFF |
| Identity as SoT | Single influencer id; DNA keyed by influencer; Discovery links to it |

Global Dev state after soak cleanup: CRM profiles **0**, events **0**, `has_commercial_profile` flags **0**.

---

## 8. Integration test results

End-to-end soak path executed:

```
Staging DNA insert
→ promote (identity create)
→ promoteStaging merge
→ baseline DNA
→ promote ×2 (idempotent)
→ promoteStaging ×3 (noop)
→ ensureCommercialCreator ×3 (writers OFF)
→ dual-event helper (writers OFF)
→ cleanup
```

All harness checks **passed** (`ok: true`). Soak artifacts deleted.

Apify payload → identity path was validated at unit/rename level (`ensureIdentityCreatorFromApifyData`); full live Apify dataset import was not re-run in this soak (condition).

---

## 9. Risks discovered

| Risk | Severity | Notes |
|---|---|---|
| CRM tables missing `service_role` GRANT initially | Low | Fixed Dev+Prod; migration added |
| Linked promote still re-runs baseline DNA (~1s) | Low / known | Not introduced by CRM; watch if Phase 2B increases promote frequency |
| Interactive Discovery / worker soak incomplete | Medium (process) | Accept as condition before broad wiring |
| Accidental `CREATOR_CRM_WRITERS_ENABLED=true` in env | High if set | Keep OFF until workflow approval; document in `.env.example` |

---

## 10. Recommendation

### **Ready with conditions**

Phase 2A is architecturally sound for Development soak and safe to keep deployed with writers OFF.

**Conditions before approving workflow wiring (Phase 2B+):**

1. Confirm `CREATOR_CRM_WRITERS_ENABLED` is unset/false on Development Vercel.  
2. Optional: one interactive smoke of Discovery Browse + Shortlist on Dev Preview.  
3. Optional: one offline Apify import smoke if Import Center is in active use on Dev.  
4. Explicit approval of the next Option C stream (assignment/quote/VIO) before any call-site wiring.

**Do not begin Phase 2B–2F implementation until this report is reviewed and approved.**

---

## Appendix — How to re-run

```bash
# Unit / boundary
npm run test:creator-crm-phase2a

# Dev soak harness (requires Dev service role in .env)
npx tsx scripts/soak-creator-crm-phase2a.ts
```
