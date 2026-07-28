# Release 2.0 — Phase 1 Validation Report

**Status:** Phase 1 **code complete** — Development soak is the next gate ([DEVELOPMENT_SOAK_PLAN.md](./DEVELOPMENT_SOAK_PLAN.md))  
**Branch:** `feature/release-2-0-lifecycle`  
**Date:** 2026-07-28  
**Environment validated (schema/code):** Development Supabase `hsxrewjcbvmbkqdlzjhs`  
**Production:** Not touched · **Phase 2:** Blocked until Phase 1 is Production-stable

---

## 1. Scope validated

| Item | Status |
|---|---|
| Unified Quote → Assignment convert | Done |
| Commercial snapshot + accepted pin | Done |
| Provenance on `campaign_lines` | Done |
| D2 selected options / D3 package → one Assignment | Done |
| D4 header status `planning` | Done |
| Idempotent convert + dry-run | Done |
| Quotation UI “Convert to Campaign” | Done |
| Backfill wizard (detect → preview → execute → summary) | Done |
| Path B → `convertQuotationToAssignments` when quote linked | Done |
| Feature flag OFF by default | Done (explicit env required to enable) |
| Media Plan / Performance / Billing refactors | Out of scope (unchanged) |

---

## 2. Migration results (Development)

**Applied:** `supabase/migrations/20260728120000_release_2_0_assignment_convert.sql`  
**Method:** `npx supabase db query --linked -f …` (linked project `hsxrewjcbvmbkqdlzjhs`)  
**Note:** Full `db push` blocked by unrelated older local migrations not on remote; R2.0 SQL applied directly and verified.

### Schema verification

| Object | Present |
|---|---|
| `campaign_headers.accepted_quotation_id` | Yes |
| `campaign_headers.accepted_quotation_version` | Yes (via migration) |
| `campaign_lines.source_quotation_id` | Yes |
| `campaign_lines.source_quotation_item_id` | Yes |
| `assignment_deliverables.service_description` | Yes |
| `assignment_deliverables.free_for_client` | Yes |
| `campaign_commercial_snapshots` | Yes |
| RLS policies select + insert on snapshots | Yes |

### Background schema validation

A background schema validation failed due to a temporary Supabase authentication/configuration issue (`LegacyDbConfigConnectTempRoleError` caused by a missing `SUPABASE_DB_PASSWORD` in the validation environment). This was verified not to be a schema migration failure. Manual verification on the Development Supabase instance confirmed that all Release 2.0 schema objects, including `campaign_commercial_snapshots` and the required Assignment lifecycle columns, were successfully applied.

**Tracking (infrastructure only — not Release 2.0):**  
`docs/infrastructure/BACKLOG_DEV_SCHEMA_VALIDATION_CREDENTIALS.md`

### Smoke after migration

| Check | Result |
|---|---|
| Existing tables readable (`campaign_headers`, `quotations`, `vendor_ios`, `invoices`) | OK (queries succeeded) |
| Snapshot table empty / ready | OK |
| Feature flag not forced on Production | OK (default off unless `development` surface or explicit env) |

Manual UI smoke still recommended on `dev.thinkwaymedia.com` after deploy: campaigns, quotations, Vendor IO, Billing, Media Plan load.

---

## 3. Conversion tests

| Test | Result |
|---|---|
| Approved-only gate (D1) | Pass (`canCreateCampaignFromQuotation`) |
| Draft / sent / accepted rejected | Pass |
| Package → one convert unit (D3) | Pass |
| Alternative options skipped (D2) | Pass |
| Snapshot hash stable / changes with revenue | Pass |
| Dry-run precedes snapshot insert & `createCampaignLine` | Pass |
| Path A wires convert behind flag | Pass |
| Path B uses convert when quote linked | Pass |

Command:

```bash
npx tsx --test \
  lib/domains/commercial/quotation-convert-selection.test.ts \
  lib/domains/commercial/quotation-convert-snapshot.test.ts \
  lib/release/release-2-0-feature-flag.test.ts \
  lib/services/campaigns/convert-quotation-to-assignments.test.ts \
  lib/services/campaigns/backfill-assignments-from-quotation.test.ts
```

---

## 4. Assignment / convert contract

| Expectation | Implementation |
|---|---|
| Header status `planning` | `createCampaignHeaderFromBrand({ status: "planning" })` |
| Quote pin | `accepted_quotation_id` + `accepted_quotation_version` |
| Provenance | `source_quotation_id` + `source_quotation_item_id` on lines |
| Snapshot hash in payload | `payload.snapshot_hash` |
| Package financial unit | One Assignment; members as additional `campaign_influencers` |

---

## 5. Backfill validation

| Expectation | Result |
|---|---|
| Legacy detection (quote + 0 lines) | Implemented |
| Dry-run preview | `dryRun: true` — no writes |
| Execute audited | `release_2_0_backfill_assignments` audit event |
| VIO / Billing preservation | Detection requires zero lines; warnings if VIO/invoice present on lines |
| Never automatic | UI wizard opt-in only |

---

## 6. Regression

| Case | Behaviour |
|---|---|
| Flag explicitly `false` | Legacy Path A create (header + vendor links); Path B plan slate path |
| Flag on / Dev surface | Unified convert |
| Campaigns without quotation | Unaffected; manual Create assignment remains |
| Invoiced / VIO campaigns with lines | Not eligible for backfill |

---

## 7. Performance comparison

| Path | Notes |
|---|---|
| Convert | O(n) Assignment creates via existing `createCampaignLine`; browse creators once by influencer ids |
| Dry-run | No writes; selection + hash only |
| Backfill | Same as convert with `reuseHeaderId` |

No measured regression vs Path B line loop; Path B with quote now delegates to the same engine (one code path).

---

## 8. Known limitations (Phase 1)

1. Full `supabase db push --include-all` not used — older pending migrations remain unapplied on remote; R2.0 SQL applied surgically.  
2. `syncCampaignInfluencerForLine` still assumes one influencer per line for general updates; package members use direct insert.  
3. Platform mapping still requires resolvable influencer platform accounts (same as Path B).  
4. Commercial Revision / Difference Engine not in Phase 1.  
5. Media Plan non-live edit hard guards not in Phase 1 (D7 documented only).  
6. Local (`NEXT_PUBLIC_THINKWAY_ENV` unset) keeps flag off unless `RELEASE_2_0_ASSIGNMENT_CONVERT=true`.  
7. End-to-end browser soak on Dev deployment pending after merge/deploy.

---

## 9. Rollback procedure

1. Set `RELEASE_2_0_ASSIGNMENT_CONVERT=false` (and `NEXT_PUBLIC_…`) on the deployment.  
2. UI falls back to legacy create; Path B uses prior seed loop when flag off.  
3. Schema columns/tables are additive — leave in place (no DROP).  
4. Do not delete commercial snapshots or provenance rows.

---

## 10. Go / No-Go

| Gate | Recommendation |
|---|---|
| Development merge to `develop` after PR review | **Go** (after CI green) |
| Enable soak on `dev.thinkwaymedia.com` | **Go** (flag defaults on for `development` surface) |
| Production migration / flag | **No-Go** until Dev soak + explicit Production approval |

**Overall Phase 1 code:** **Go for Development soak** · **No-Go for Production** until soak exit criteria are all green.

---

## 11. Sign-off checklist

- [x] Migration applied on Development  
- [x] Schema verified  
- [x] Automated conversion / selection / flag / backfill tests  
- [x] UI Convert dialog + Backfill wizard  
- [x] Path B unified engine when quote linked  
- [ ] Deployed Dev soak (manual) — [DEVELOPMENT_SOAK_PLAN.md](./DEVELOPMENT_SOAK_PLAN.md)  
- [ ] All soak exit criteria green (no yellow)  
- [ ] `PRODUCTION_READINESS_REVIEW.md` authored  
- [ ] Explicit Production approval  
