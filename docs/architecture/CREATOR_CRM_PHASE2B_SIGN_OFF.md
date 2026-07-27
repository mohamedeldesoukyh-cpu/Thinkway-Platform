# Creator CRM — Phase 2B Sign-off

**Date:** 2026-07-27  
**Branch:** `develop`  
**Status:** Implemented — writers remain OFF by default (Production unchanged)  
**Pre-coding record:** `CREATOR_CRM_PHASE2B_PRE_CODING.md`

---

## Scope delivered

### 2B.1 — `campaign_assignment`

| Entry | Wiring |
|---|---|
| `syncCampaignInfluencerForLine` | Hub → `maybeActivateCommercialCreatorForAssignment` |
| `insertCampaignAssignment` | Same helper after insert (returns id) |
| `moveShortlistToCampaign` | Same helper after CI success |

### 2B.2 — Dual-event quote→campaign

| Entry | Wiring |
|---|---|
| `createCampaignFromQuotation` | After CI insert → `ensureCommercialCreatorFromQuoteToCampaign` (`quotation_operational` + `campaign_assignment`) |

**Not wired:** VIO, Manual Convert, Portal, list filter, backfill, Discovery import/Apify/promote/shortlist-add/draft quotes.

---

## Success criteria

| Criterion | Evidence |
|---|---|
| Assignment creates Commercial Creator once | PK + unit: one profile after sync |
| Repeat assignments idempotent | Unique event source; unit: second sync same CI → 1 event |
| Dual-event audit | Helper + lifecycle tests; quotation event distinct source |
| Discovery no regression | `test:discovery-shortlist`, `test:discovery-ui-contract` pass |
| No UI changes | No Vendors/Discovery UI edits |
| Production identical with writers OFF | Flag unset; ensure no-ops |

**Tests:** `npm run test:creator-crm-phase2b` → **20/20 pass**

---

## Feature flags

| Env | Writers |
|---|---|
| Production | **OFF** (unset) |
| Development / Preview | **OFF** until explicit Dev soak enable |
| Local default | **OFF** |

To soak on Dev only: set `CREATOR_CRM_WRITERS_ENABLED=true` on Preview for the minimum validation window, then unset.

---

## Rollback

1. Keep / set `CREATOR_CRM_WRITERS_ENABLED=false`.  
2. Revert call-site commits if needed.  
3. Optional Dev CRM row cleanup by reason/time.

---

## Architecture

Identity → Discovery → Commercial (optional, gated).  
Discovery operates with CRM module disabled (writers OFF).
