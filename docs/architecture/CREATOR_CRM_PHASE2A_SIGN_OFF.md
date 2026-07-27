# Creator CRM — Phase 2A Sign-off

**Date:** 2026-07-27  
**Branch:** `develop`  
**Status:** Complete — awaiting Dev soak review before workflow wiring (2B–2F)  
**Parent decision:** Option C (`CREATOR_CRM_PHASE2_IMPLEMENTATION_PROPOSAL.md`)  
**Commit:** `8d87d01`  
**Preview:** Ready — `gitSha` `8d87d01…`; `/api/ready` → `{"status":"ok"}`; Dev Supabase aligned

---

## 1. Architecture changes implemented

| Change | Detail |
|---|---|
| Identity rename | `ensureCommercialCreatorFromApifyData` → `ensureIdentityCreatorFromApifyData` (exported) |
| Identity boundary | `lib/creators/identity/ensure-identity.ts` re-exports identity ensure; documents CRM isolation |
| DNA staging promote | `CreatorDNAService.promoteStaging(discoveredProfileId, influencerId)` |
| Promote wiring | `promoteDiscoveredProfileToInfluencer` merges staging → canonical before baseline DNA |
| Writer gate | `CREATOR_CRM_WRITERS_ENABLED` — default **OFF**; `ensureCommercialCreator` no-ops when OFF |
| Activation helpers | Assignment / quotation / VIO / dual quote→campaign helpers (unwired) |
| Dual-event strategy | `ensureCommercialCreatorFromQuoteToCampaign` records `quotation_operational` + `campaign_assignment` |

**Not implemented (deferred):** Campaign / Quotation / Assignment / Vendor IO / Manual Convert / Portal invite call-site wiring.

---

## 2. Identity / DNA integration summary

1. Apify offline import continues to create/update **identity** only via `ensureIdentityCreatorFromApifyData`.  
2. On Discovery promote (new or already-linked influencer):  
   - `promoteStaging` merges staged field envelopes into `creator_dna`  
   - marks staging `promoted_to_influencer_id` / `promoted_at`  
   - records lineage `staging_promotion`  
   - then `requireCreatorBaselineDna` fills remaining gaps  
3. No CRM profile is created by import, promote, or DNA merge.

---

## 3. Updated service boundaries

```
L1 Identity          L2 Discovery           L3 Commercial CRM
─────────────────    ──────────────────     ─────────────────────────
ensureIdentity*      browse / shortlist     ensureCommercialCreator
promote → DNA        (no CRM)               (+ activation helpers)
Apify identity       promote (identity)     writers gate OFF by default
```

- CRM package does not import Apify pipeline or promote-profile.  
- Identity must not call CRM ensure.  
- Activation helpers exist for future approved wiring only.

---

## 4. Test results

```
npm run test:creator-crm-phase2a  → 25/25 pass
```

Includes: writer gate default OFF, ensure no-op when OFF, dual-event helpers, promoteStaging idempotency, legacy name removed, no production CRM wiring.

---

## 5. Performance assessment

| Path | Impact |
|---|---|
| Apify rename | None (same code path) |
| promoteStaging | Extra staging read + optional merge on promote only; skipped when no staging / already promoted |
| Writer gate OFF | Zero CRM DB writes on any future accidental call until enabled |
| Vendors / Discovery browse | Unchanged |

---

## 6. Security / RLS review

- No new tables or RLS changes in Phase 2A.  
- Phase 1 CRM RLS unchanged.  
- Writer gate prevents CRM persistence until workflow approval.  
- Convert RBAC still enforced inside ensure when writers are ON.

---

## 7. Backward compatibility

- Discovery import / URL-add / shortlist behaviour unchanged (identity + DNA only).  
- Campaign / Quotation / Assignment / VIO / Reporting / Vendors UI unchanged.  
- Filter flag remains OFF.  
- Writer gate OFF → even helper calls would not persist CRM rows.

---

## 8. Confirmation — no behavioural / UI changes to product surfaces

Phase 2A introduces **no** user-facing CRM filter, Convert button, status badges, or automatic commercial activation from workflows.  
DNA staging merge runs only on existing identity promote paths and improves intelligence completeness without changing CRM membership.

---

## Gate for next steps

After Dev soak review, approve workflow integration streams separately (proposal Option C continuation: assignment/quote/VIO/convert). Portal invite remains deferred to Creator Portal phase.
