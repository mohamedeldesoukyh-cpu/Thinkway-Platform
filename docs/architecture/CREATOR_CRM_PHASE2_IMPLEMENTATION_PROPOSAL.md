# Creator CRM — Phase 2 Implementation Proposal

**Status:** DRAFT — pending review and approval (no implementation until approved)  
**Date:** 2026-07-27  
**Branch context:** `develop`  
**Depends on:** Phase 1 CLOSED — `CREATOR_CRM_PHASE1_MILESTONE.md`  
**Parent architecture:** `CREATOR_CRM_FINAL_ARCHITECTURE.md` (locked decisions §16)

---

## 0. Purpose of this proposal

Phase 1 delivered schema + `ensureCommercialCreator()` with **zero** behavioural change.

Phase 2 is the first phase that may introduce **workflow wiring and behavioural changes**. This document is the approval gate before any of that work begins.

It covers:

1. All workflow integrations  
2. Discovery integration (and explicit non-integrations)  
3. Campaign integration  
4. Quotation integration  
5. Assignment integration  
6. Vendor IO integration  
7. Manual Convert workflow  
8. Activation events  
9. Rollout order  
10. Migration impact  
11. Validation and rollback strategy  

**No Phase 2 code will be written until this proposal is approved.**

---

## 1. Goals and non-goals

### 1.1 Goals

| Goal | Outcome |
|---|---|
| Identity rename | Eliminate Apify name collision (`ensureCommercialCreatorFromApifyData` → identity helper) |
| DNA staging merge | Identity promote merges staging → canonical DNA (Phase 2b) |
| Sole CRM entry enforced | All commercial activations call `ensureCommercialCreator` only |
| Controlled activation | Activation matrix from architecture §7 / §16 is implemented at real call sites |
| Auditable events | Every activation writes `creator_crm_activation_events` with reason + source |
| Safe rollout | Feature-flagged writers where needed; flag OFF remains safe rollback for list UX |
| Tests | Unit + integration fixtures prove forbidden paths do **not** activate CRM |

### 1.2 Non-goals (explicitly out of Phase 2 unless separately approved)

| Out of scope | Deferred to |
|---|---|
| CRM list filter / `/creators` rename / `/vendors` redirect | Later UI phase (was Phase 5) |
| Historical backfill of commercial creators | Later migration phase (was Phase 3) |
| Completeness scoring UI / Incomplete ops queue | Later ops phase (was Phase 7) |
| Reporting CRM dimensions | Later reporting phase (was Phase 8) |
| Auto Incomplete → Active after VIO | **Never** (locked) |
| CRM activation from draft / pricing-approved quotations | **Never** (locked) |
| CRM activation from Discovery import / Apify / shortlist add / identity promote alone | **Never** (locked) |

> **Scope clarification for approval:** Architecture §17 labelled “Phase 2” as backend services only, with assignment/quote/VIO wiring in “Phase 6”. This proposal **repackages** the first behavioural delivery into a single reviewable Phase 2 with **ordered workstreams (2A–2F)** so you can approve all, some, or a subset before any wiring.

---

## 2. Locked product rules (must not regress)

| Rule | Implication |
|---|---|
| Flag OFF = legacy full Vendors list | Phase 2 must not change list queries while filter flag is OFF |
| Quotations activate CRM only when **operational** (→ campaign) | Never on draft / pricing-approved / shortlist commercial sync |
| Convert roles = AM, Ops, Admin, Super Admin | Finance consumes only |
| Incomplete → Active never auto after first VIO | Recommend only; no status trigger |
| Identity ≠ CRM | `ensureIdentity*` never writes CRM; `ensureCommercialCreator` never creates identity |
| `ensureCommercialCreator` is sole CRM entry | No direct inserts into `creator_crm_profiles` outside that function (except controlled admin/backfill jobs later) |

---

## 3. Proposed Phase 2 workstreams

| ID | Workstream | Behavioural change? | Requires separate go/no-go |
|---|---|---|---|
| **2A** | Identity rename + boundary hardening | No (rename/refactor only) | Low risk — recommend always |
| **2B** | DNA staging → canonical on identity promote | Yes (identity data completeness) | Medium — recommend with 2A |
| **2C** | CRM writer helpers + activation event standards | No (unused until wired) | Low |
| **2D** | Assignment + Campaign + Quotation→campaign wiring | **Yes** | **High — explicit approval** |
| **2E** | Vendor IO + Manual Convert (+ portal link) wiring | **Yes** | **High — explicit approval** |
| **2F** | Validation suite expansion + rollout docs | No | Always with any of 2D/2E |

**Recommended approval options**

- **Option A (conservative):** Approve 2A + 2B + 2C + 2F only. Defer 2D/2E to a later “Phase 2.5 / Phase 6” plan.  
- **Option B (full Phase 2 as requested):** Approve 2A–2F in the rollout order below.  
- **Option C (staged):** Approve 2A–2C now; re-approve 2D then 2E after Dev soak.

This proposal is written for **Option B**, with gates so Option A/C remain possible.

---

## 4. Workflow integrations (master matrix)

| Workflow | Activate CRM? | Reason | Source entity | Call site(s) |
|---|---|---|---|---|
| Apify / dataset import | **No** | — | — | `lib/discovery/apify-import-pipeline.ts` (rename only) |
| URL-add creator | **No** | — | — | `lib/discovery/add-creator-by-profile-url.ts` |
| Identity promote | **No** | — | — | `lib/discovery/promote-profile.ts` |
| Shortlist add | **No** | — | — | `features/discovery/shortlists/actions.ts` |
| Shortlist → draft quote sync | **No** | — | — | `lib/commercial-sync/engine.ts` |
| Create quotation / draft items | **No** | — | — | `lib/services/quotations/quotation-service.ts`, generate-from-plan |
| Quotation → campaign (operational) | **Yes** | `quotation_operational` | `quotation` / assignment | `quotation-lifecycle-service.ts`:`createCampaignFromQuotation` |
| Campaign plan → campaign | **Yes** | `quotation_operational` or `campaign_assignment` | campaign line / CI | `generate-campaign-from-campaign-plan.ts` via line sync |
| Assignment create / attach | **Yes** | `campaign_assignment` | `campaign_influencer` | `campaign-influencer-sync.ts`:`syncCampaignInfluencerForLine`; `insertCampaignAssignment`; `moveShortlistToCampaign` |
| Vendor IO create | **Yes** | `vendor_io` | `vendor_io` | `features/io/generate-vendor-io-action.ts` |
| Vendor IO revise (new row) | **Yes** (idempotent) | `vendor_io` | `vendor_io` | revise actions / batch |
| Manual Create Vendor | **Yes** | `manual_create` | `influencer` | `features/vendors/actions.ts`:`createVendorAction` |
| Manual Convert (Discovery → CRM) | **Yes** | `manual_convert` | `influencer` | **New** server action (2E) |
| Portal profile link | **Yes** | `portal_invite` | `profile` / influencer | `setInfluencerProfileLinkAction` |
| Enrichment promote | **No** | — | — | `lib/services/creators/*` |
| VIO document regenerate only | **No** | — | — | `vendor-io-document-service.ts` |

---

## 5. Discovery integration

### 5.1 What Phase 2 changes

| Change | Detail |
|---|---|
| Rename Apify identity helper | `ensureCommercialCreatorFromApifyData` → `ensureIdentityCreatorFromApifyData` (or export from `lib/creators/identity/`) |
| DNA staging merge (2B) | On `promoteDiscoveredProfileToInfluencer`, merge `creator_dna_staging` → `creator_dna` (identity integrity) |
| Convert action (2E, if approved) | New “Convert to commercial creator” for AM/Ops/Admin calling `ensureCommercialCreator({ reason: 'manual_convert' })` |
| Guard tests | Fixtures assert import / URL-add / shortlist / promote alone leave `creator_crm_profiles` empty |

### 5.2 What Phase 2 must not change

- Discovery browse ranking, shortlist UX, Studio match  
- Import writing `influencers` as identity inventory  
- Shortlist commercial sync into draft quotations  

### 5.3 Convert UX (if 2E approved)

- Placement: Discovery creator detail / sheet action (minimal)  
- Permission: `canConvertToCommercialCreator(roleSlug)`  
- Result: CRM profile `incomplete` + activation event; no list filter yet (Vendors still full while flag OFF)  
- Copy: clarify Convert ≠ enrich / ≠ shortlist  

---

## 6. Campaign integration

### 6.1 Activation point

Centralise on assignment creation success:

1. Prefer wrapping **`syncCampaignInfluencerForLine`** so line create/update and plan→campaign inherit behaviour.  
2. Also cover direct inserts: `insertCampaignAssignment`, `moveShortlistToCampaign`.  

```
on campaign_influencers insert/upsert success
  → ensureCommercialCreator({
      reason: 'campaign_assignment',
      sourceEntityType: 'campaign_influencer',
      sourceEntityId: <ci.id>,
      actorId,
      bypassRoleCheck: true  // system path
    })
```

### 6.2 Behavioural impact

- First operational assignment for a Discovery-only identity creates Incomplete CRM profile.  
- Idempotent if already CRM.  
- Duplicate campaign copy: ensure on new CI rows.  
- Vendor move (`operations` update `influencer_id`): ensure for destination influencer if missing (edge).  

### 6.3 Non-changes

- Campaign financials, line PO logic, workspace UI layout  
- No Incomplete→Active automation  

---

## 7. Quotation integration

### 7.1 Activate only on operationalise

| Event | CRM |
|---|---|
| Draft quotation created | No |
| Pricing approved | No |
| Shortlist sync writes quote items | No |
| `createCampaignFromQuotation` succeeds | **Yes** — `quotation_operational` |
| `generateCampaignFromCampaignPlan` creates execution campaign | **Yes** |

### 7.2 Dual reason handling

Operational quote→campaign typically also creates assignments. Prefer:

1. Call ensure once per influencer with `quotation_operational` at quotation lifecycle boundary, **or**  
2. Rely on assignment path with `campaign_assignment` and additionally log a `quotation_operational` event with distinct `source_entity_id`.

**Proposal (recommended):**  
- Primary ensure at assignment insert (`campaign_assignment`).  
- Additionally insert activation event / ensure with `quotation_operational` + `sourceEntityType='quotation'` when `createCampaignFromQuotation` runs (idempotent profile; second event if source unique).  

This preserves audit (“became commercial because quote went operational”) without double profiles.

---

## 8. Assignment integration

| Path | File | Action |
|---|---|---|
| Line sync | `lib/campaigns/campaign-influencer-sync.ts` | Ensure after successful upsert |
| Quote repo insert | `quotation-repository.ts`:`insertCampaignAssignment` | Ensure after insert |
| Shortlist → campaign | `moveShortlistToCampaign` | Ensure after CI insert (promote remains identity-only beforehand) |
| VIO pre-create CI | `generate-vendor-io-action.ts` | Ensure via assignment path before/with VIO |

**Race safety:** PK on `creator_crm_profiles.influencer_id` + existing 23505 handling in `ensureCommercialCreator`.

---

## 9. Vendor IO integration

| Event | CRM | Status advance |
|---|---|---|
| Create Vendor IO | Yes (`vendor_io`) | **None** (stay Incomplete unless already higher) |
| Revise Vendor IO (new IO id) | Yes (idempotent event) | None |
| Regenerate document only | No | — |
| First VIO for Incomplete creator | Recommend Active in UI later | **No auto** (locked) |

```
on vendor_ios insert success
  → ensureCommercialCreator({
      reason: 'vendor_io',
      sourceEntityType: 'vendor_io',
      sourceEntityId: <vendor_io.id>,
      bypassRoleCheck: true
    })
```

---

## 10. Manual Convert workflow

### 10.1 Manual create

Wire `createVendorAction` → `ensureCommercialCreator({ reason: 'manual_create', roleSlug, actorId })` **without** `bypassRoleCheck` (enforce convert roles). Finance denied.

### 10.2 Manual convert

New server action (suggested):

`features/creators/crm/convert-to-commercial-action.ts`  
or under `features/discovery/...` / `features/vendors/...`

Inputs: `influencerId`  
Checks: auth + `canConvertToCommercialCreator`  
Calls: `ensureCommercialCreator({ reason: 'manual_convert', ... })`  
Returns: created | already commercial  

### 10.3 Portal invite

Wire `setInfluencerProfileLinkAction` when `profile_id` newly set → `portal_invite`.

---

## 11. Activation events

### 11.1 Required fields

| Field | Rule |
|---|---|
| `reason` | From enum; match matrix |
| `actor_id` | User when manual; system/actor when workflow |
| `source_entity_type` | Stable strings: `campaign_influencer`, `quotation`, `vendor_io`, `influencer`, `profile` |
| `source_entity_id` | UUID of source when available |
| `metadata` | Minimal: `{ path, document_number? }` — no PII dumps |

### 11.2 Uniqueness

Existing unique index on `(influencer_id, reason, source_entity_type, source_entity_id)` where source not null prevents event spam on retries.

### 11.3 Forbidden direct writes

App code outside `ensureCommercialCreator` must not insert into `creator_crm_profiles` / events (enforce via lint/test boundary).

---

## 12. Rollout order (within Phase 2)

```
2A Identity rename + tests
    ↓
2B DNA staging promote (identity)
    ↓
2C CRM helper wrappers + event conventions + writer feature gate (optional env)
    ↓  [GO/NO-GO if Option C]
2D Wire assignment + quotation→campaign (+ campaign plan)
    ↓  Dev soak / smoke
2E Wire Vendor IO + manual create/convert + portal link
    ↓
2F Full validation suite + sign-off note
```

### 12.1 Environment order

1. Implement on `develop`  
2. Deploy Dev Preview / Development app  
3. Smoke matrix (§14) on Development Supabase  
4. Merge/release per normal develop→main process **only after approval of behavioural streams**  
5. Keep `CREATOR_CRM_FILTER_ENABLED` **OFF** throughout Phase 2  

### 12.2 Optional writer gate

Add `CREATOR_CRM_WRITERS_ENABLED` (server-only, default **false** until 2D go-live on an env):

- When false: `ensureCommercialCreator` no-ops (or logs) — allows shipping 2A–2C safely  
- When true: real writes  

**Decision needed:** approve writer gate (recommended) vs always-on ensure once call sites merge.

---

## 13. Migration impact

| Change | Impact |
|---|---|
| Phase 2A–2C | No DDL required (Phase 1 schema sufficient) |
| Phase 2D–2E | No DDL; runtime inserts into empty CRM tables begin |
| DNA 2B | May need small DDL if `promoteStaging` API requires helpers — audit before coding; prefer reuse of existing DNA tables |
| Backfill | **Not in Phase 2** — historical commercial creators remain without CRM until later phase |
| Prod data growth | Only newly activated creators; low volume vs ~7k identity rows |
| RLS | No policy widening planned; reuse Phase 1 policies |
| Vendors list performance | Unchanged while filter flag OFF (no join) |

---

## 14. Validation strategy

### 14.1 Automated

| Suite | Assert |
|---|---|
| Unit | Rename: no remaining `ensureCommercialCreatorFromApifyData` symbol |
| Unit | Identity promote / Apify / shortlist fixtures → 0 CRM rows |
| Unit | `ensureCommercialCreator` idempotency + manual RBAC (existing + extend) |
| Integration (Dev) | Create assignment → CRM row + event `campaign_assignment` |
| Integration (Dev) | Draft quote + shortlist sync → still 0 CRM for that creator |
| Integration (Dev) | Quote→campaign → CRM + `quotation_operational` and/or assignment event |
| Integration (Dev) | VIO create → CRM + `vendor_io`; status remains Incomplete |
| Integration (Dev) | Finance role cannot manual_convert |
| Boundary test | Update when 2D/2E land (allow listed call sites only) |

### 14.2 Manual smoke (Development)

1. Import / URL-add creator → appears in Discovery; **no** CRM profile  
2. Shortlist + draft quote → **no** CRM profile  
3. Move to campaign / create assignment → CRM Incomplete  
4. Generate Vendor IO → event logged; status not auto-Active  
5. Manual Convert as AM → CRM; as Finance → denied  
6. `/vendors` still lists full inventory (flag OFF)  

### 14.3 Performance

- Spot-check assignment create latency before/after ensure (single PK upsert)  
- Confirm Vendors list RPC/path unchanged  

---

## 15. Rollback strategy

| Layer | Rollback |
|---|---|
| Writer gate OFF | Stops new CRM writes immediately; existing profiles remain |
| Revert call-site commit(s) | Stop activations; additive CRM rows harmless while flag OFF |
| Delete mistaken CRM rows | Admin/SQL by `activated_reason` / time window (document runbook) |
| DNA 2B | Feature-flag or revert promoteStaging call; staging rows retained |
| Identity rename | Pure refactor — revert commit if needed |
| Schema | Phase 1 rollback SQL still valid if CRM unused; **do not** drop schema once Prod has real CRM rows without data migration plan |
| List UX | Filter flag remains OFF — no user-facing list regression path in Phase 2 |

**RTO target:** disable writer gate / revert wiring within one deploy; no need to drop tables.

---

## 16. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Accidental CRM on Apify via name confusion | High | 2A rename first; boundary tests |
| Draft quote over-activation | High | Forbidden list + fixture tests on commercial-sync |
| Ensure inside promote | High | Code review gate; promote stays identity |
| Double ensure CI + VIO | Low | Idempotent PK + unique events |
| Empty CRM list if filter enabled early | High | Keep filter OFF; no Phase 5 in this proposal |
| DNA staging data loss | Medium | 2B before relying on promote for commercial paths |
| Ops expects Convert without training | Medium | Minimal copy; Convert optional until UI phase |

---

## 17. Deliverables checklist (after approval)

- [ ] 2A Identity rename merged + tests green  
- [ ] 2B DNA staging promote implemented + tests  
- [ ] 2C Helpers / writer gate (if approved)  
- [ ] 2D Assignment + quotation operational wiring  
- [ ] 2E Vendor IO + manual create/convert + portal link  
- [ ] 2F Validation + Phase 2 sign-off note  
- [ ] Dev smoke complete; filter flag still OFF  
- [ ] Explicit decision recorded: Option A / B / C  

---

## 18. Approval request

Please review and respond with:

1. **Option A, B, or C** (see §3)  
2. Approve / reject **writer gate** (`CREATOR_CRM_WRITERS_ENABLED`, default false)  
3. Approve / reject **portal_invite** wiring in 2E vs defer  
4. Confirm dual-event strategy for quote→campaign (§7.2)  
5. Any call sites to add/remove from the matrix (§4)  

Until approval, **no Phase 2 implementation will start.**

---

## Appendix A — File reference (implementation map)

| Area | Primary files |
|---|---|
| CRM ensure | `lib/creators/crm/ensure-commercial-creator.ts` |
| Identity boundary | `lib/creators/identity/ensure-identity.ts` |
| Apify rename | `lib/discovery/apify-import-pipeline.ts` |
| Promote + DNA | `lib/discovery/promote-profile.ts`, `features/creator-dna/services/creator-dna-service.ts` |
| Assignment hub | `lib/campaigns/campaign-influencer-sync.ts` |
| Quote→campaign | `lib/services/quotations/quotation-lifecycle-service.ts` |
| Shortlist→campaign | `features/discovery/shortlists/actions.ts` |
| Vendor IO | `features/io/generate-vendor-io-action.ts` |
| Manual vendor | `features/vendors/actions.ts` |
| Portal link | `features/vendors/actions.ts`:`setInfluencerProfileLinkAction` |

## Appendix B — Relationship to architecture phase numbers

| This proposal | Architecture §17 label |
|---|---|
| 2A–2C | Phase 2 (+ 2b DNA) |
| 2D | Phase 6 (partial: assignment + quote) |
| 2E | Phase 6 (VIO) + Phase 4 Convert stub + Phase 7 portal |
| Backfill / list filter / reporting | Still later phases — not requested here for implementation |

Architecture phase numbers remain the long-range roadmap; this document is the **executable approval package** for the next coding tranche.
