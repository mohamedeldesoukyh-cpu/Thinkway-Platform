# Deliverables Documentation Repository — Phase 1 UAT Sign-off

**Status:** Phase 1 approved — Preview / Development UAT in progress  
**Feature freeze after green UAT:** defect fixes only (same discipline as Commercial SSOT)  
**Environment:** Development / Preview — `https://dev.thinkwaymedia.com`  
**Branch:** `develop` · Phase 1 commit `01da502c` (+ follow-ups)  
**Dev migration:** `20260730120000_deliverable_documentation_repository.sql` (applied)  
**Production:** Untouched until explicit approval after UAT  
**Spec:** [`DELIVERABLES_DOCUMENTATION_REPOSITORY.md`](./DELIVERABLES_DOCUMENTATION_REPOSITORY.md)

**Automated gate:** `npm run test:deliverable-docs`

---

## Phase 1 approval record

| Item | Status |
|---|---|
| Documentation repository (not workflow engine) | ✅ Approved |
| No Publication / Performance coupling | ✅ Approved |
| Qty=1 and multi-post granularity | ✅ Approved |
| Received = file or link (not text alone) | ✅ Approved |
| Docs indicator ≠ execution ring | ✅ Approved |
| Mandatory asset types | ✅ Approved |
| Creator / Client Portal deferred | ✅ Approved |
| Bulk Upload | ⏳ Phase 2 backlog (not this phase) |

---

## UAT scenarios

### A. Single deliverable

| # | Scenario | Result |
|---|---|:----:|
| A1 | Upload asset | ☐ |
| A2 | Replace / add new version (prior version preserved) | ☐ |
| A3 | Add internal comment | ☐ |
| A4 | Documentation indicator updates on Media Plan | ☐ |
| A5 | Open Deliverables from Media Plan docs dot | ☐ |
| A6 | History / versions visible | ☐ |

### B. Multiple deliverables (e.g. 3 Stories)

| # | Scenario | Result |
|---|---|:----:|
| B1 | Receive only Story 1 → creator Partial (🟠) | ☐ |
| B2 | Receive Story 2 → still Partial | ☐ |
| B3 | Receive Story 3 → Complete (🟢) | ☐ |
| B4 | Assets not mixed across Story units | ☐ |

### C. Mixed asset types

| # | Type | Result |
|---|---|:----:|
| C1 | Video file | ☐ |
| C2 | Image | ☐ |
| C3 | PDF | ☐ |
| C4 | Google Drive link | ☐ |
| C5 | Dropbox link | ☐ |
| C6 | Canva link | ☐ |
| C7 | Caption/text alone does **not** mark Received | ☐ |

### D. Large-campaign performance (critical)

Validate with a campaign shaped like: **~150 creators × ~3 deliverables**, multiple versions, hundreds of assets.

| # | Check | Result |
|---|---|:----:|
| D1 | Deliverables tab remains usable / responsive | ☐ |
| D2 | Search by creator | ☐ |
| D3 | Search by deliverable type | ☐ |
| D4 | Filter by documentation status (Received / Partial / Not received) | ☐ |
| D5 | Filter by asset type | ☐ |
| D6 | Sort by last updated | ☐ |
| D7 | Note gaps: pagination / infinite scroll / lazy attachment load / on-demand previews | ☐ |

If D1–D6 fail under load, treat as **High** defects before Production — may require Phase 1.1 performance work (pagination, lazy detail, list virtualization).

### E. Regression

| # | Area | Result |
|---|---|:----:|
| E1 | Assignments | ☐ |
| E2 | Campaign Studio | ☐ |
| E3 | Media Plan (Original / Actual execution rings unchanged) | ☐ |
| E4 | Publications | ☐ |
| E5 | Performance | ☐ |
| E6 | Commercial SSOT | ☐ |
| E7 | Finance | ☐ |

---

## Phase 2 backlog (not Phase 1)

### Bulk Documentation Upload

Agency batch intake workspace:

- Drag-and-drop multiple files  
- Paste multiple links  
- Assign to creators / documentation units  
- Review before save  

Deferred until after Phase 1 freeze + portals planning.

Also deferred: Creator Portal submission · Client view/download/comment (no approval engine).

---

## Sign-off

| Field | Value |
|---|---|
| Tester | |
| Date | |
| Build SHA | |
| Overall | ☐ Pass · ☐ Fail · ☐ Blocked |
| Critical / High open | |
| Freeze after green UAT | Defect fixes only |

**Production:** only after green UAT + explicit approval (migrate + deploy).
