# Creator CRM Phase 2B — Development Soak Report

**Date:** 2026-07-27  
**Branch / commit:** `develop` @ `9bee37d` (+ soak harness `scripts/soak-creator-crm-phase2b.ts`)  
**Environment:** Development Supabase `hsxrewjcbvmbkqdlzjhs`  
**Vercel Preview:** `CREATOR_CRM_WRITERS_ENABLED=true` enabled for soak window only, then **removed**  
**Production:** Unchanged — flag never set  
**Harness:** `npx tsx scripts/soak-creator-crm-phase2b.ts` → `ok: true`  
**Status:** Soak complete — **Ready with conditions** for Phase 2C review (no Phase 2C implementation started)

---

## 1. Executive summary

Phase 2B Development soak validates real CRM persistence when writers are ON for allowlisted operational paths only (campaign assignment + quote→campaign dual-event), with idempotency, Discovery isolation, and a complete writers-OFF no-op gate.

| Area | Result |
|---|---|
| First campaign assignment → 1 profile / 1 `campaign_assignment` event | **PASS** |
| Repeat assignment idempotent (no second profile/event; linkage updates) | **PASS** |
| Quote→campaign dual-event (`quotation_operational` + `campaign_assignment`) | **PASS** |
| Repeated dual-event creates no duplicates | **PASS** |
| Discovery promote / DNA / rediscovery create zero CRM while identity exists | **PASS** |
| Writers OFF: assignment succeeds, zero CRM writes | **PASS** |
| Cleanup restores CRM baseline (0/0/0) | **PASS** |
| Automated Discovery regression suites | **PASS** |
| Interactive Preview UI E2E (Browse / AI Search / Import UI) | **Not executed** (SSO / process condition) |
| Production env | **Unchanged** (flag never present) |
| Preview writers flag after soak | **Removed** |

**Recommendation: Ready with conditions** — approve Phase 2C planning only after accepting §9 conditions. Do not implement Phase 2C until this report is reviewed and explicitly approved.

---

## 2. Database before/after snapshots

Global CRM counts on Development (`hsxrewjcbvmbkqdlzjhs`):

| Moment | `creator_crm_profiles` | `creator_crm_activation_events` | `has_commercial_profile` flagged |
|---|---:|---:|---:|
| Before soak | 0 | 0 | 0 |
| After writers ON (assignment + dual-event) | 1 | 3 | 1 |
| After writers OFF assignment | 1 | 3 | 1 |
| After cleanup | 0 | 0 | 0 |

Soak tag: `soak2b_1785115669787`  
Influencer under test: `e132be9e-12fb-454c-bee8-cfcf775477ff` (created via Discovery promote with writers OFF)  
Campaign header reused: `20374f67-1c2f-4df0-b999-124a8d506c3c` (temporary draft lines inserted/deleted by harness)

Event breakdown at peak (writers ON):

| Reason | Count |
|---|---:|
| `campaign_assignment` | 2 (two distinct campaign_influencer source IDs) |
| `quotation_operational` | 1 |
| **Total** | **3** |

---

## 3. CRM profile counts

| Check | Expected | Observed |
|---|---|---|
| After first assignment | 1 | 1 |
| After repeat assignment | 1 | 1 |
| After quote→campaign dual-event | 1 | 1 |
| After repeat dual-event | 1 | 1 |
| After rediscovery promote | 1 | 1 |
| After writers-OFF assignment | 1 | 1 |
| After cleanup | 0 | 0 |

No duplicate Commercial Creator profiles were created for the soak identity.

---

## 4. CRM activation event counts

| Scenario | Events |
|---|---|
| Promote / DNA (writers OFF, pre-assignment) | 0 |
| First `syncCampaignInfluencerForLine` | +1 `campaign_assignment` |
| Repeat sync (same CI id, updated deliverable_count) | +0 |
| Quote→campaign dual helper (new CI id) | +1 `quotation_operational`, +1 `campaign_assignment` |
| Repeat dual helper (same quotation + CI sources) | +0 |
| Assignment with writers OFF (new line/CI) | +0 |

Idempotency is enforced by unique `(influencer_id, source_type, source_id)` on activation events plus profile PK on `influencer_id`.

---

## 5. Idempotency verification

| Scenario | Result | Evidence |
|---|---|---|
| 1. First assignment | PASS | CI `a1c990e9-…`; profiles=1; assignmentEvents=1 |
| 2. Repeat assignment | PASS | Same CI id returned; profiles=1; events=1; `deliverable_count=2` linkage update |
| 3. Quote→campaign | PASS | Dual helper `ok`; events=3 (2 assignment + 1 quotation); profile still 1; `created=false` on second commercial ensure |
| 3b. Repeat conversion | PASS | `eventId` / `quotationEventId` / `assignmentEventId` all null; counts unchanged |
| Identity / DNA | PASS | `influencers=1`, `creator_dna=1` throughout |
| 5. Writers OFF | PASS | New CI created; profiles 1→1; events 3→3 |

---

## 6. Discovery regression results

Harness (writers OFF then ON around operational paths only):

| Path exercised | CRM created? | Result |
|---|---|---|
| Discovery promote (new identity) | No | PASS |
| DNA staging `promoteStaging` (noop / already promoted) | No | PASS |
| Rediscovery promote (same handle) | No | PASS (`created=false`, CRM counts unchanged) |

Automated suites:

| Suite | Result |
|---|---|
| `npm run test:creator-crm-phase2b` | 20/20 pass |
| `test:discovery-ui-contract` | pass |
| `test:discovery-shortlist` | pass |
| `test:discovery-browse-id-stage` | pass |
| `test:discovery-unified-browse-tags` | pass |
| `test:discovery-import-upsert` | pass |
| `lib/creators/dna-browse-hydration.test.ts` | pass |

**Not covered interactively in this soak:** live Preview Browse UI, Discovery Search UI, AI Search, Shortlists UI click-path, Discovery Import Center UI, live metrics refresh worker. Static + unit boundary tests continue to assert Discovery / Apify / draft-quote paths do not import CRM activation helpers.

---

## 7. Performance observations

Harness timings (Development, single soak creator):

| Operation | Duration (ms) |
|---|---:|
| First assignment (`syncCampaignInfluencerForLine` + CRM write) | 725 |
| Repeat assignment (idempotent CRM) | 544 |
| Quote→campaign dual-event helper | 421 |
| Assignment with writers OFF | 356 |

**Observations**

- First CRM write adds ~180–370 ms vs writers-OFF assignment on this run (order-of-magnitude acceptable for Dev soak; not a formal SLO).  
- Repeat assignment remains sub-second and does not inflate CRM rows.  
- Dual-event path is a single helper round-trip (~420 ms) for two events + existing profile.  
- No worker/queue/memory soak was run; no evidence of CRM write amplification on Discovery paths.

---

## 8. Defects found

| Item | Severity | Disposition |
|---|---|---|
| `service_role` lacks INSERT on `campaign_headers` (harness used existing header + `psql` for lines) | Low (test harness only) | Documented; not a product defect |
| Brand→header sync trigger field `agency_or_direct` blocked creating a throwaway header | Low (harness) | Worked around by reusing existing header |
| Interactive Preview Discovery E2E blocked / not run (SSO) | Medium (process) | Condition for Phase 2C approval |
| Artifacts JSON write failed in harness (non-fatal) | Low | Did not affect checks |

No product defects in Phase 2B activation wiring, idempotency, dual-event audit, or writers gate were observed.

---

## 9. Recommendation

### **Ready with conditions**

Phase 2B is validated on Development for allowlisted writers-ON persistence and writers-OFF safety. Production remains writers-OFF / unchanged.

**Conditions before approving Phase 2C:**

1. Confirm `CREATOR_CRM_WRITERS_ENABLED` remains **unset** on Production and Preview after this soak (**done this session** — Preview var removed; Production never had it).  
2. Optional: one interactive smoke of Discovery Browse + Shortlist + Search on Dev Preview after next deploy with flag OFF.  
3. Explicit product approval of Phase 2C scope (what gets wired next) before any implementation.  
4. Keep writers OFF on all Vercel environments until a dedicated enablement window is scheduled.

**Do not begin Phase 2C implementation until this report is reviewed and explicitly approved.**

---

## 10. Environment control log

| Action | Environment | Result |
|---|---|---|
| Enable `CREATOR_CRM_WRITERS_ENABLED=true` | Vercel Preview (`develop`) | Applied for soak window |
| Soak harness writers ON/OFF in-process | Local → Dev DB | PASS |
| Disable / remove flag | Vercel Preview (`develop`) | **Removed** via `vercel env rm … --yes` |
| Production | — | Never set; confirmed absent |

---

## Appendix — How to re-run

```bash
# Unit / boundary
npm run test:creator-crm-phase2b

# Dev soak (requires Dev service role in .env; temporarily set writers true in-process)
npx tsx scripts/soak-creator-crm-phase2b.ts
```

For a Preview-hosted soak, set `CREATOR_CRM_WRITERS_ENABLED=true` on Preview only for the minimum window, redeploy, validate, then immediately `vercel env rm CREATOR_CRM_WRITERS_ENABLED preview develop --yes`.
