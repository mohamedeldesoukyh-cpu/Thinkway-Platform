# Release 2.2 — Client IO Enterprise Completion — UAT Checklist

**Environment:** Preview / Development (`dev.thinkwaymedia.com`) first  
**Supabase:** Development `hsxrewjcbvmbkqdlzjhs`  
**Production:** only after Feature Freeze + explicit approval  
**Parent:** [`RELEASE_2_2_IMPLEMENTATION.md`](./RELEASE_2_2_IMPLEMENTATION.md)  
**Architecture Validation:** ✅ Approved ([`RELEASE_2_2_ARCHITECTURE_VALIDATION.md`](./RELEASE_2_2_ARCHITECTURE_VALIDATION.md))  
**Implementation Validation:** [`RELEASE_2_2_IMPLEMENTATION_VALIDATION.md`](./RELEASE_2_2_IMPLEMENTATION_VALIDATION.md)

---

## Priority scenarios (Preview focus)

| # | Scenario | Expect | Pass |
|---|---|---|---|
| P1 | **Standard lifecycle** | Draft → Generated → Sent → Under Client Review → Approved | ☐ |
| P2 | **Amendment lifecycle** | Approve → Create Amendment → `/A1` → Generate → prior tip immutable + history shows both | ☐ |
| P3 | **Billing milestones** | Each template applies; 100% enforced; schedule on document; copied on amendment | ☐ |
| P4 | **Assignment integrity** | Only selected Assignment IDs in doc; snapshot unchanged after Media Plan schedule edits | ☐ |
| P5 | **Regression** | Commercial Workspace, Media Plan, Assignments, Deliverables, Timeline, R2.1 unaffected | ☐ |

**Timeline note (R-T1):** On send, Enterprise Timeline should show **both** `client_io.sent` and `client_io.under_client_review`. Tip status = `under_client_review`.

---

## Functional

| # | Case | Expect | Pass |
|---|---|---|---|
| C1 | Ensure CIO on campaign | Creates/loads tip; Convert still did not auto-create | ☐ |
| C2 | Assignment composer | Can select subset of Assignments by line ID | ☐ |
| C3 | Generate with selection | PDF/HTML includes only selected Assignments; rollups match | ☐ |
| C4 | Empty selection blocked | Cannot generate with zero Assignments | ☐ |
| C5 | Preview / layouts | detailed / package / package_main still work | ☐ |
| C6 | Send + recipients | Email + `io_notifications`; tip → `under_client_review`; Timeline sent + under_client_review | ☐ |
| C7 | Client approve (token/portal) | Approves **current tip**; stamps approved; Timeline `client_io.approved` | ☐ |
| C8 | Create amendment | Prior tip immutable; new tip `/A1` generated; history visible | ☐ |
| C9 | Amendment content | Reflects updated selection/milestones; root chain intact | ☐ |
| C10 | Billing milestones | Templates + custom schedule persist and appear on document | ☐ |
| C11 | Timeline | generate/send/review/approve/amend/supersede events visible | ☐ |
| C12 | Finance lock | Commercial lock still engages when CIO exists | ☐ |
| C13 | Cancel | Cancelled tip; cancel audit present (dedicated Timeline emitter deferred R-T2) | ☐ |

## Regression

| # | Case | Expect | Pass |
|---|---|---|---|
| R1 | Convert | Still does not create CIO | ☐ |
| R2 | Commercial SSOT / Workspace | No unauthorized commercial writes from CIO | ☐ |
| R3 | Media Plan / Assignments / Deliverables | Unaffected (R2.1 still green) | ☐ |
| R4 | VIO / Invoice | Unaffected (milestones not executed) | ☐ |
| R5 | Client IO register `/ios/client` | Lists tip documents correctly (superseded hidden from tip lists) | ☐ |

## Sign-off

| Role | Name | Date | Result |
|---|---|---|---|
| Product | | | |
| Finance / AM | | | |
| Engineering | | | |
