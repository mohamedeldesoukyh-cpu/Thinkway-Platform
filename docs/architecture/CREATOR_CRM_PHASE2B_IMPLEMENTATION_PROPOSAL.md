# Creator CRM — Phase 2B Implementation Proposal  
## Option C next stream: Operational Campaign Activation (incremental)

**Status:** APPROVED with modifications · **IMPLEMENTED** — see `CREATOR_CRM_PHASE2B_SIGN_OFF.md` / `CREATOR_CRM_PHASE2B_PRE_CODING.md`  
**Date:** 2026-07-27  
**Depends on:** Phase 2A CLOSED + Dev soak approved + operational checks (`CREATOR_CRM_PHASE2A_OPERATIONAL_CHECKS.md`)  
**Parent:** `CREATOR_CRM_PHASE2_IMPLEMENTATION_PROPOSAL.md` (Option C) · `CREATOR_CRM_FINAL_ARCHITECTURE.md`

---

## 0. Purpose

Phase 2A delivered identity rename, DNA staging promote, CRM helpers, and writer gate **OFF**.  
Phase 2B is the **first behavioural workflow wiring** under Option C — limited to commercial activation when work becomes **operational** (campaign / assignment execution).

This proposal must be approved before any call-site changes.

---

## 1. Exact scope

### 1.1 In scope (Phase 2B only)

Wire Commercial Creator activation for **two activation sources**, implemented and validated **independently** in sequence:

| Step | Activation source | Reason enum | Helper |
|---|---|---|---|
| **2B.1** | Campaign assignment create/attach | `campaign_assignment` | `ensureCommercialCreatorFromAssignment` |
| **2B.2** | Quotation → campaign (operationalise) | Dual: `quotation_operational` + `campaign_assignment` | `ensureCommercialCreatorFromQuoteToCampaign` |

Also in scope:

- Enable `CREATOR_CRM_WRITERS_ENABLED=true` **on Development only** after 2B.1 code is merged and ready for Dev soak (not Production).  
- Unit + Dev integration tests for each step.  
- Boundary tests updated to allow **listed** call sites only.  
- Phase 2B validation / sign-off note.

### 1.2 Explicitly out of scope

| Out | Deferred to |
|---|---|
| Vendor IO activation | Later stream (was 2E) |
| Manual Convert / Manual Create CRM ensure | Later stream |
| Portal invite | Creator Portal phase (locked deferral) |
| CRM list filter / `/creators` rename | Later UI phase |
| Historical backfill | Later migration phase |
| Incomplete → Active auto-transition | **Never** |
| Discovery import / Apify / URL-add / shortlist **add** / draft quotes / AI / enrichment CRM | **Never** |

### 1.3 Business rule (non-negotiable)

Commercial Creator activation occurs **only** when a quotation becomes **operational** (campaign / assignment execution), or via an equivalent operational assignment path.

**Never** during:

- Discovery browse/search/AI  
- Apify / dataset imports  
- DNA promotion / staging merge  
- Shortlisting  
- Draft quotations / pricing-approved-only  
- AI workflows  
- Enrichment  

Discovery remains isolated from Commercial CRM until an approved activation condition is met.

---

## 2. Files to be modified

### 2.1 Step 2B.1 — Assignment only

| File | Change |
|---|---|
| `lib/campaigns/campaign-influencer-sync.ts` | After successful CI upsert/attach in `syncCampaignInfluencerForLine`, call `ensureCommercialCreatorFromAssignment` (best-effort log on failure; do not fail assignment) |
| `lib/services/quotations/repositories/quotation-repository.ts` | After `insertCampaignAssignment` success, call same helper **or** rely solely on sync if all inserts go through sync — prefer **one** hub to avoid double-calls |
| `features/discovery/shortlists/actions.ts` | **Only** `moveShortlistToCampaign` after CI insert (not shortlist-add actions) |
| `lib/creators/crm/boundary.test.ts` | Allow the above call sites; keep forbidding Discovery/import/Apify/promote |
| New: `lib/campaigns/campaign-influencer-crm.test.ts` (or similar) | Unit tests with mocks: writers OFF → no persistence; writers ON → one profile |

**Prefer single hub:** If `insertCampaignAssignment` and shortlist→campaign already call `syncCampaignInfluencerForLine`, wire CRM **only** in `syncCampaignInfluencerForLine` to minimise duplication.

### 2.2 Step 2B.2 — Quotation operational (dual-event)

| File | Change |
|---|---|
| `lib/services/quotations/quotation-lifecycle-service.ts` | In `createCampaignFromQuotation`, after assignment(s) succeed, call `ensureCommercialCreatorFromQuoteToCampaign` per influencer (quotation id + campaign_influencer id) |
| `features/quotations/lifecycle-actions.ts` | Pass-through actor only if needed (no Discovery changes) |
| Tests | Dual-event + writers gate; draft quotation paths still produce **zero** CRM rows |

### 2.3 Files that must not be modified for CRM

| Area | Files |
|---|---|
| Apify / identity import | `lib/discovery/apify-import-pipeline.ts` |
| Promote / DNA | `lib/discovery/promote-profile.ts`, `features/creator-dna/**` (except if tests only) |
| URL-add | `lib/discovery/add-creator-by-profile-url.ts` |
| Shortlist **add** | `addCreatorToShortlistV2` / `addCreatorsToShortlistsV2` |
| Draft commercial sync | `lib/commercial-sync/engine.ts` |
| Draft quote create | `lib/services/quotations/quotation-service.ts` create paths |
| Vendor IO | `features/io/generate-vendor-io-action.ts` |
| Manual convert/create | `features/vendors/actions.ts` (except future stream) |
| Vendors list UI / filter | `features/vendors/queries.ts` |

---

## 3. Architectural impact

```
Identity (unchanged)
    ↓
Discovery (unchanged — no CRM)
    ↓
Operational campaign / assignment  ← NEW (Phase 2B, gated)
    ↓
ensureCommercialCreator → creator_crm_profiles + activation_events
```

| Layer | Impact |
|---|---|
| L1 Identity | None |
| L2 Discovery | None for browse/search/shortlist-add/import; `moveShortlistToCampaign` may create CRM **only after** CI insert (operational), not on shortlist membership |
| L3 Commercial | First real writers when gate ON |
| Finance / VIO | None in 2B |
| List UX | None (filter flag remains OFF) |

---

## 4. Sequence of implementation

```
0. Operator completes authenticated Preview smoke (Browse/Shortlists/Search/Studio)
   + optional Import smoke if Import Center active
        ↓
1. Implement 2B.1 (assignment hub) with writers still OFF in all envs
        ↓
2. Unit tests green; merge to develop
        ↓
3. Set CREATOR_CRM_WRITERS_ENABLED=true on Development Preview only
        ↓
4. Dev soak: create assignment → assert CRM Incomplete + event campaign_assignment
   Negative: shortlist add / draft quote → still 0 CRM
        ↓
5. GO/NO-GO for 2B.2
        ↓
6. Implement 2B.2 dual-event on createCampaignFromQuotation
        ↓
7. Dev soak: quote → campaign → dual events; no status auto-advance
        ↓
8. Phase 2B sign-off; keep Production writers OFF
```

**Do not** enable writers on Production in Phase 2B.

---

## 5. Feature flag strategy

| Flag | Phase 2B policy |
|---|---|
| `CREATOR_CRM_WRITERS_ENABLED` | Default OFF. Enable **Development only** after 2B.1 merge for soak. Production remains unset/false. |
| `CREATOR_CRM_FILTER_ENABLED` / `NEXT_PUBLIC_…` | Remains **OFF** (no list UX change). |

Rollback of behaviour: unset/false writers → `ensureCommercialCreator` no-ops again; existing CRM rows remain but no new writes.

Optional future: per-reason kill switches — **not** required for 2B if writers gate is sufficient.

---

## 6. Rollback strategy

| Layer | Action |
|---|---|
| Immediate | Set `CREATOR_CRM_WRITERS_ENABLED=false` (or remove) on Dev |
| Code | Revert call-site commit(s); helpers remain unused |
| Data | Optional admin delete of CRM rows created during Dev soak by `activated_reason` / time window |
| Schema | No DDL in 2B — Phase 1 rollback unused |

RTO: one Vercel env change; no migration required.

---

## 7. Validation plan

### 7.1 Automated (each step)

- Writers OFF: assignment/quote→campaign code paths invoke ensure but persist nothing.  
- Writers ON (test env): one CI create → one CRM profile + one `campaign_assignment` event.  
- Idempotent second assignment same influencer → no second profile; unique source event behaviour.  
- Draft quotation / shortlist add fixtures → 0 CRM rows.  
- Boundary test: only allowlisted files reference `ensureCommercialCreator`.  
- Discovery suites unchanged and still green.

### 7.2 Dev soak (writers ON)

| Scenario | Expect |
|---|---|
| New campaign line assignment | CRM Incomplete + `campaign_assignment` |
| Quote → campaign | Dual events; one profile |
| Shortlist add only | No CRM |
| Draft quote sync | No CRM |
| Import / Apify | No CRM |
| Promote only | No CRM |
| Vendors list | Still full inventory (filter OFF) |

### 7.3 Performance

- Spot-check assignment create latency before/after (single PK upsert).  
- Confirm no Vendors list join/filter introduced.

---

## 8. Expected behavioural changes

| When writers OFF (default / Production) | No user-visible change; ensure no-ops |
|---|---|
| When writers ON (Dev soak only) | First operational assignment or quote→campaign creates Incomplete commercial profile + audit events |
| Discovery UX | Unchanged |
| Draft quotations | Unchanged |
| CRM status | Remains Incomplete; **no** auto Active |

---

## 9. Discovery isolation confirmation

Phase 2B **does not** call `ensureCommercialCreator` from:

- Discovery Search / Browse / AI Search  
- Apify / import pipelines  
- DNA `promoteStaging` / baseline  
- Shortlist add  
- Draft quotation creation or shortlist commercial sync  
- Enrichment / AI studio matching without assignment  

`moveShortlistToCampaign` is treated as **operational campaign execution** (creates `campaign_influencers`), not as Discovery exploration. Shortlist membership alone never activates CRM.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Double ensure on quote→campaign (assignment hub + lifecycle) | Prefer dual-event helper once in lifecycle **or** assignment-only + separate quotation event insert; document chosen pattern in PR |
| Accidental Production writers ON | Checklist: Production env must remain unset; PR description forbids Prod enable |
| moveShortlistToCampaign surprise CRM | Document as operational; soak negative tests for shortlist-add |
| Soft-fail ensure hides bugs | Log structured warning; do not block campaign create |

---

## 11. Approval request

Please confirm:

1. **Approve Phase 2B scope** as 2B.1 (assignment) then 2B.2 (quote→campaign dual-event) only?  
2. **Dev-only writers enable** after 2B.1 merge — yes/no?  
3. **Hub strategy:** wire CRM only in `syncCampaignInfluencerForLine` vs also explicit `insertCampaignAssignment`? (Recommend single hub.)  
4. Operator confirmation that authenticated Preview smoke (§ operational checks) is complete?  

**No Phase 2B code will be written until explicit approval of this proposal.**

---

## Appendix — Mapping to prior Option C labels

| This proposal | Prior proposal ID |
|---|---|
| Phase 2B.1 + 2B.2 | Part of stream **2D** |
| Vendor IO / Convert | Still **2E** — separate future proposal |
| Portal | Deferred |
| List filter / backfill | Later phases |
