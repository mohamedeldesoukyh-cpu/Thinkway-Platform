# Release 2.0 — Enterprise Campaign Lifecycle Refactoring

**Status:** Phase 1 foundation **implemented + validated on Development** (2026-07-28)  
**Branch:** `feature/release-2-0-lifecycle` (from `develop`)  
**Sign-off artefact:** [PHASE_1_VALIDATION.md](./PHASE_1_VALIDATION.md)  
**Environment:** Development Supabase (`hsxrewjcbvmbkqdlzjhs`). Production requires separate approval.

---

## Mission

Replace fragmented Quote → Campaign conversion with a unified **Assignment-based lifecycle**:

| Concern | SSOT |
|---|---|
| Commercial offer | **Quotation** (convert only when `approved`) |
| Operational execution unit | **Campaign Assignment** = `campaign_lines` (+ deliverables → posts + vendor links) |
| Planned scheduling | **Media Planning** (Original / Current rules — hard guards Phase 2) |
| Actual execution | **Performance** (feeds Actual Media Plan) |
| IO / Billing / Payments / Reporting / AI | Same **Assignment hierarchy** |

---

## Document index

| # | Document | Purpose |
|---|---|---|
| 0 | [DECISIONS.md](./DECISIONS.md) | **Locked D1–D7** (normative) |
| 1 | [FIELD_OWNERSHIP_MATRIX.md](./FIELD_OWNERSHIP_MATRIX.md) | **Every field → one owner** (developer contract) |
| 2 | [RELEASE_2_0_ARCHITECTURE.md](./RELEASE_2_0_ARCHITECTURE.md) | Vision, entity graph, lifecycle |
| 3 | [ASSIGNMENT_SSOT_AND_CONVERSION.md](./ASSIGNMENT_SSOT_AND_CONVERSION.md) | Convert contract (aligned to D1–D5) |
| 4 | [MEDIA_PLAN_LIFECYCLE_OWNERSHIP.md](./MEDIA_PLAN_LIFECYCLE_OWNERSHIP.md) | Original / Current / Actual (D7) |
| 5 | [IMPACT_ANALYSIS.md](./IMPACT_ANALYSIS.md) | Cross-surface impact |
| 6 | [IMPLEMENTATION_ORDER.md](./IMPLEMENTATION_ORDER.md) | Dependency graph + phases |
| 7 | [MIGRATION_BACKFILL_AND_RISKS.md](./MIGRATION_BACKFILL_AND_RISKS.md) | Backfill tiers (D5) + risks |

---

## Locked decisions (summary)

| ID | Decision |
|---|---|
| **D1** | Convert only from quotation status `approved` |
| **D2** | Convert selected options only (Phase 1: Option 1 / primary); alternatives via V2 → Apply Changes later |
| **D3** | One Collap package → one Assignment; deliverables/posts as children; PO/GP/AF at package line |
| **D4** | Header status after convert = `planning` |
| **D5** | Backfill: detect → dry run → execute (never silent) |
| **D6** | After Assignment Published: lock planned date/creator/platform/deliverables; metrics/URL/billing/payments remain editable |
| **D7** | Original frozen; Current only if Assignment not Published; Actual generated never editable |

---

## Phase 1 scope (approved — do not extend)

**In:**

- Unified Quote → Assignment conversion  
- Commercial snapshot + accepted quotation pin  
- Provenance on lines  
- Assignment deliverables from quote scope  
- Idempotent convert  
- Feature flag (Dev first)  
- Backfill wizard (opt-in: detect / dry run / execute)  
- Compliance with field ownership matrix  

**Out (Phase 2+):**

- Media Plan refactor / hard Current guards  
- Performance refactor  
- Billing changes  
- Commercial Revision / Difference Engine  
- Reporting redesign  
- Full status enum rename  

**Team rule:** Establish the lifecycle foundation with **zero regressions**. Do not optimize or extend beyond this scope during Phase 1.

---

## Approval record

| Item | State |
|---|---|
| Architecture package | Approved 2026-07-28 |
| D1–D7 | Locked in [DECISIONS.md](./DECISIONS.md) |
| Field ownership matrix | Required contract — [FIELD_OWNERSHIP_MATRIX.md](./FIELD_OWNERSHIP_MATRIX.md) |
| Phase 1 coding | Authorized after matrix landed |
| Production deploy / Prod DB | **Not** authorized by this approval |
