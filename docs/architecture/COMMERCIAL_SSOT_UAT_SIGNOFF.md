# Commercial SSOT — End-to-End UAT Sign-off

**Status:** UAT approved to execute — results pending  
**Feature status:** Feature-complete (Phases 1–4). **Feature freeze** — bug fixes only.  
**Environment:** Development only — `https://dev.thinkwaymedia.com`  
**Database:** Development Supabase `hsxrewjcbvmbkqdlzjhs`  
**Branch / commits:** `develop` · Phase 4 `73b8e574` (+ continuity `04bdec6a`)  
**Migration (Dev applied):** `supabase/migrations/20260729210000_commercial_revisions.sql`  
**Production:** Untouched — no merge, migrate, or deploy until this sign-off is green and Production is explicitly approved  
**Normative spec:** [`COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md`](./COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md) · Decision **D-COMM**

**Automated gate (pre-UAT):** `npm run test:commercial-ssot-phase4` — must remain green.

---

## Sign-off record

| Field | Value |
|---|---|
| Tester | |
| Date | |
| Build SHA (`/api/build-info`) | |
| Overall verdict | ☐ Pass · ☐ Fail · ☐ Blocked |
| Critical defects open | |
| High defects open | |
| Medium defects (workaround agreed?) | |
| Sign-off signature | |

**Legend:** ☐ Pass · ☐ Fail · ☐ N/A · ☐ Blocked

---

## Exit criteria

A Commercial SSOT release candidate may be proposed only when **all** sections below pass (or are explicitly N/A with justification).

### 1. Commercial Synchronization

| # | Scenario | Expected | Result |
|---|---|---|:----:|
| 1.1 | Create Quotation | Quotation created with Commercial Lines | ☐ |
| 1.2 | Generate Campaign | Assignments linked by Origin Commercial Line ID | ☐ |
| 1.3 | Edit every Master field from Quotation | Campaign updates for dirty Masters only | ☐ |
| 1.4 | Edit every Master field from Campaign | Quotation updates for dirty Masters only | ☐ |
| 1.5 | Only modified Master fields synchronize | Unchanged Masters not rewritten | ☐ |
| 1.6 | Derived fields recalculate | GP / totals / EGP / AF amounts correct on both sides | ☐ |
| 1.7 | Operational fields never synchronize | Schedule/status/notes stay Campaign-only | ☐ |
| 1.8 | Sync confirmation shown when linked | Normative dual-document confirmation copy | ☐ |

**Section expected:** Pass.

---

### 2. Finance Lock

Create finance artefacts **one by one**. For each locked state verify: direct Master edit blocked · correct warning · Commercial Revision offered.

| # | Lock trigger | Direct edit blocked | Warning correct | Revision offered | Result |
|---|---|:---:|:---:|:---:|:----:|
| 2.1 | Vendor IO | ☐ | ☐ | ☐ | ☐ |
| 2.2 | Client IO | ☐ | ☐ | ☐ | ☐ |
| 2.3 | Purchase Order | ☐ | ☐ | ☐ | ☐ |
| 2.4 | Client Invoice | ☐ | ☐ | ☐ | ☐ |
| 2.5 | Vendor Invoice | ☐ | ☐ | ☐ | ☐ |
| 2.6 | Payment Request | ☐ | ☐ | ☐ | ☐ |
| 2.7 | Payment | ☐ | ☐ | ☐ | ☐ |
| 2.8 | Closed Accounting Period | ☐ | ☐ | ☐ | ☐ |

**Section expected:** Pass.  
**API:** `Campaign.isFinanceLocked()` / `isCampaignFinanceLocked` only.

---

### 3. Commercial Revision lifecycle

| # | Scenario | Expected | Result |
|---|---|---|:----:|
| 3.1 | Create Revision (multi Master fields) | Draft with dirty Masters, reason required | ☐ |
| 3.2 | Submit for Approval | Status `pending_approval` | ☐ |
| 3.3 | Approve & Apply | Quotation + Campaign updated; Derived recalculated | ☐ |
| 3.4 | Reject | Commercials unchanged; status `rejected` | ☐ |
| 3.5 | Cancel | Draft/pending cancelled; no commercial write | ☐ |
| 3.6 | Version incremented | New commercial version appended | ☐ |
| 3.7 | Previous version preserved | Prior snapshot immutable | ☐ |
| 3.8 | Field-level audit written | Old → new per Master field | ☐ |
| 3.9 | Concurrent pending blocked | Second pending revision rejected | ☐ |
| 3.10 | Stale concurrency rejected | Apply fails safely; not marked applied | ☐ |

**Section expected:** Pass.

---

### 4. Identity integrity

| # | Scenario | Expected | Result |
|---|---|---|:----:|
| 4.1 | 1 Quotation Line → 1 Assignment | Sync by CML ID | ☐ |
| 4.2 | 1 Quotation Line → Multiple Assignments | All peers update; absolute amounts allocated per policy | ☐ |
| 4.3 | Sync never uses row position | Reorder Assignments; sync still correct | ☐ |
| 4.4 | Unrelated row delete | Remaining CML-linked rows still sync | ☐ |
| 4.5 | Origin CML ID never rewritten | After revision / split, Origin unchanged | ☐ |

**Section expected:** Pass.

---

### 5. Audit

Every commercial sync / revision action must record:

| Field | Present | Result |
|---|:---:|:----:|
| Commercial Line ID | ☐ | ☐ |
| User | ☐ | ☐ |
| Timestamp | ☐ | ☐ |
| Changed field | ☐ | ☐ |
| Previous value | ☐ | ☐ |
| New value | ☐ | ☐ |
| Source (Quotation / Campaign / Revision) | ☐ | ☐ |
| Revision Number (where applicable) | ☐ | ☐ |

**Section expected:** Pass.

---

### 6. Version history

| # | Scenario | Expected | Result |
|---|---|---|:----:|
| 6.1 | Previous versions immutable | Historical snapshots not mutated | ☐ |
| 6.2 | New versions append | Version number increases | ☐ |
| 6.3 | Revision metadata displayed | Revision #, reason, approver, date | ☐ |
| 6.4 | Field changes traceable | UI shows old → new summary | ☐ |
| 6.5 | Campaign Overview → Commercial history | Pending + versions load correctly | ☐ |

**Section expected:** Pass.

---

### 7. Regression (no impact)

| # | Area | Smoke steps | Result |
|---|---|---|:----:|
| 7.1 | Campaign Generation | Convert / generate from Quotation | ☐ |
| 7.2 | Campaign Regeneration | Regenerate path still works | ☐ |
| 7.3 | Media Plan | Open / revise Studio Media Plan | ☐ |
| 7.4 | Campaign Overview | Overview loads; commercial strip intact | ☐ |
| 7.5 | Assignment Management | Edit operational Assignment fields | ☐ |
| 7.6 | Discovery | Search / shortlist flows | ☐ |
| 7.7 | Discovery AI | AI search still responds | ☐ |
| 7.8 | Campaign Intelligence | Intelligence surfaces load | ☐ |
| 7.9 | Finance | Existing VIO / Invoice / Payment flows | ☐ |
| 7.10 | Reporting | Key reports open | ☐ |
| 7.11 | Dashboard summaries | Dashboard KPIs load | ☐ |

**Section expected:** Pass.

---

## Defect severity policy

| Severity | UAT exit |
|---|---|
| **Critical** | Must be 0 |
| **High** | Must be 0 |
| **Medium** | Allowed only with agreed workaround or fix before RC |
| **Low** | Track; do not block RC if accepted |

---

## Production readiness gate (post-UAT)

Approve Production only when:

1. All UAT sections Pass (or justified N/A).  
2. No Critical / High defects remain.  
3. Medium defects have agreed workarounds or fixes.  
4. Dev migration rehearsed successfully (done for Phase 4).  
5. Rollback procedure documented and validated (below).  
6. Explicit user approval for Production migrate + deploy.

**Do not** merge to `main` or apply Production migration until this gate is signed.

---

## Recommended release flow after green UAT

1. Freeze Commercial SSOT changes (already in effect).  
2. Tag Release Candidate (e.g. `v2.0.0-rc1`).  
3. Final smoke on RC build (Dev / Preview).  
4. Explicit Production approval.  
5. Merge `develop` → `main`.  
6. Apply Production migration `20260729210000_commercial_revisions.sql` only after approval.  
7. Production smoke tests.  
8. Monitor logs + audit events for 24–48 hours.

---

## Rollback procedure (Development rehearsed / Production reserved)

| Step | Action |
|---|---|
| App | Redeploy prior known-good commit on the affected surface (Dev auto from `develop`; Prod only with approval). |
| Schema | Phase 4 tables are additive (`commercial_revisions`, `commercial_revision_lines`, nullable `campaign_commercial_snapshots.commercial_revision_id`). Rollback = stop using revision UI/paths; do **not** drop history tables in Production without explicit approval. |
| Data | Applied revisions are append-only commercial versions — do not mutate prior snapshots to “undo”; create a corrective Commercial Revision instead. |
| Validation | Re-run `npm run test:commercial-ssot-phase4` and Finance Lock smoke after any rollback. |

---

## Feature freeze statement

With UAT under way, **no further Commercial SSOT feature work** unless a UAT defect requires a fix. Future commercial modules (Change Orders, Budget Revisions, PO Amendments, etc.) must reuse this SSOT + CML identity + sync + revision framework — they do not restart design.
