# Phase 2B — Pre-coding implementation record

**Date:** 2026-07-27  
**Status:** Approved scope locked — implementation follows this document  

---

## 1. Exact files modified

### 2B.1

| File | Role |
|---|---|
| `lib/campaigns/campaign-influencer-sync.ts` | Canonical line-assignment hub + shared `maybeActivate…` wrapper |
| `lib/services/quotations/repositories/quotation-repository.ts` | `insertCampaignAssignment` returns id; calls same activation helper |
| `features/discovery/shortlists/actions.ts` | `moveShortlistToCampaign` only — call helper after CI success |
| `lib/creators/crm/boundary.test.ts` | Allowlist new call sites |
| `lib/campaigns/campaign-influencer-crm.test.ts` | New unit tests |
| `docs/architecture/CREATOR_CRM_PHASE2B_*.md` | This record + sign-off |

### 2B.2 (after 2B.1 validation)

| File | Role |
|---|---|
| `lib/services/quotations/quotation-lifecycle-service.ts` | After CI insert, `ensureCommercialCreatorFromQuoteToCampaign` |
| `lib/creators/crm/activation-helpers.test.ts` / lifecycle tests | Dual-event coverage |

**Not modified for CRM:** Apify, promote, URL-add, shortlist-add, commercial-sync, draft quote create, VIO, vendors convert, list queries/UI.

---

## 2. Call graph (activation entry)

```
createCampaignLine / updateCampaignLine
  → syncCampaignInfluencerForLine          [HUB]
      → maybeActivateCommercialCreatorForAssignment
          → ensureCommercialCreatorFromAssignment
              → ensureCommercialCreator  (writers gate)

moveShortlistToCampaign
  → campaign_influencers insert|update
      → maybeActivate… (same helper)

createCampaignFromQuotation               [2B.2]
  → promoteDiscoveredProfileToInfluencer  (identity only — no CRM)
  → insertCampaignAssignment
      → maybeActivate… (campaign_assignment)     [2B.1]
  → ensureCommercialCreatorFromQuoteToCampaign   [2B.2]
      → quotation_operational (audit)
      → campaign_assignment (deduped if already written)
```

**Note:** `syncCampaignInfluencerForLine` is the single hub for **line-bound** assignments. Quote and shortlist→campaign use direct CI writes today; they call the **same** helper (no duplicated activation logic). Unifying those paths onto sync is out of Phase 2B scope.

---

## 3. New database writes (writers ON only)

| Table | When |
|---|---|
| `creator_crm_profiles` | First successful ensure for influencer (PK = influencer_id) |
| `creator_crm_activation_events` | Per distinct `(influencer_id, reason, source_entity_type, source_entity_id)` |
| `influencers.has_commercial_profile` | Trigger on CRM profile insert |

Writers OFF: **zero** CRM writes (ensure early-return).

---

## 4. Idempotency strategy

| Concern | Mechanism |
|---|---|
| One CRM profile per creator | PK on `creator_crm_profiles.influencer_id` |
| Repeat sync / reassignment same CI | Unique event index on `(influencer_id, reason, source_entity_type, source_entity_id)` where source not null; 23505 → soft null eventId |
| Multiple campaigns same creator | Same profile; new events with distinct `campaign_influencer` ids |
| Dual-event after assignment ensure | Second `campaign_assignment` for same CI id deduped; `quotation_operational` uses quotation id |

---

## 5. Rollback plan

1. Set `CREATOR_CRM_WRITERS_ENABLED=false` (or unset) on Dev.  
2. Revert call-site commits if needed.  
3. Optional: delete Dev CRM rows created during soak.  
4. Production never enables writers in 2B.

---

## 6. Feature flag behaviour

| Flag | Behaviour |
|---|---|
| `CREATOR_CRM_WRITERS_ENABLED` unset/false | ensure no-ops; Production stays here |
| `true` (Dev soak only) | Persistence enabled |
| Filter flags | Remain OFF — no UI list change |

---

## 7. Tests added

- Hub fires helper with CI id + influencer id  
- Writers OFF → no persistence  
- Writers ON → one profile; second call same CI → no duplicate event  
- Boundary allowlist for sync / insert / move / lifecycle  
- 2B.2: dual reasons present; draft paths untouched  

---

## 8. Expected DB state

| Moment | `creator_crm_profiles` | Events |
|---|---|---|
| Before first operational assignment (writers ON) | 0 for creator | 0 |
| After first assignment | 1 row, status incomplete | 1× `campaign_assignment` |
| After repeat sync same CI | still 1 | still 1 for that CI source |
| After second campaign CI | still 1 profile | +1 event (new CI id) |
| After quote→campaign (2B.2) | 1 profile | +`quotation_operational` (+ assignment if new CI) |
| Writers OFF always | unchanged empty / no new rows | none |
