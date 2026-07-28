# Release 2.0 — Media Plan Lifecycle Ownership

**Status:** Approved hard rules (D7) — Phase 1 documents only; no Media Plan refactor in Phase 1  
**Parent:** [RELEASE_2_0_ARCHITECTURE.md](./RELEASE_2_0_ARCHITECTURE.md)  
**Normative:** [DECISIONS.md](./DECISIONS.md) D6–D7 · [FIELD_OWNERSHIP_MATRIX.md](./FIELD_OWNERSHIP_MATRIX.md)  
**Builds on:** `docs/architecture/MEDIA_PLANNING_V1_PRODUCTION_READINESS.md` (v1 engine SSOT — not replaced)  
**Business versioning:** [`docs/architecture/MEDIA_PLAN_VERSIONING.md`](../../architecture/MEDIA_PLAN_VERSIONING.md) — when Draft/Under Review stay on one business version + audit; post-approval immutability; Revise vs Regenerate

---

## 1. Purpose

Clarify write ownership so Media Planning does not become a second commercial or execution ledger, and so Assignment IDs remain the join key across Original / Current / Actual views.

---

## 2. View definitions (Release 2.0 language)

| Product term | v1 technical meaning | Editable? | Source of items |
|---|---|---|---|
| **Original Media Plan** | Current Approved Baseline (`kind=baseline`, approved) | **No** after publication | Baseline schedule items |
| **Current Media Plan** | Working Draft tip when present; otherwise mirrors Original for read | **Yes**, with constraints below | Draft schedule items |
| **Actual Media Plan** | Engine projection: baseline + Performance facts | **Never** (derived) | Performance live dates / publications |
| **Remaining** | Engine projection of unexecuted baseline work | Derived | Baseline − Actual |

Notes:

- v1 already uses “Current Approved Baseline” + “Working Draft”. Release 2.0 product language maps **Original** ↔ baseline, **Current** ↔ draft.
- Identity remains `mediaPlanId` ≡ `campaign_objects.id`. No new `media_plans` tables.

---

## 3. Ownership matrix

| Concern | Owner | Writes | Reads |
|---|---|---|---|
| Planned calendar / slots | Media Plan Engine | Draft tip via `media-plan-mutations` | Studio, Campaign, Portal |
| Approved published plan | Media Plan lifecycle | Promote draft → baseline only | Portal Original, Compare |
| Assignment PO / commercials | Assignment (`campaign_lines`) | Convert / finance ops | Media Plan (budget display only) |
| Live dates / URLs / metrics | Performance | Publications + post live fields | Actual / Remaining projections |
| Approvals (client plan) | Media Plan portal lifecycle | Approve / request changes / reject | Timeline |
| Approvals (content ops) | Assignment / post workflow | Execution workflow statuses | Campaign workspace |

---

## 4. Normative rules

### R1 — Original immutable after publication

Once a version is published as Current Approved Baseline (`baseline_published`):

- Baseline schedule items are immutable.
- Corrections require: create/continue Working Draft → edit → re-approve/publish as new baseline.
- Outputs and Portal Original always resolve baseline, never draft tip.

### R2 — Current editable only when Assignment is not Published (D7)

Working Draft may change planned dates/slots **only when** the linked Assignment is **not Published** (D6/D7):

| Assignment state | Current draft edit allowed? |
|---|---|
| Draft / Planning / Scheduled / Approved (pre-Published) | Yes |
| **Published** (`posted` Phase 1 trigger) | **No** for planned date/creator/platform/deliverables |
| Has Performance publication / confirmed live | **No** |
| Billing locked / invoiced post | **No** |

**Phase 1:** Document only — **no Media Plan refactor**. Hard engine guards are Phase 2.

### R3 — Actual generated from Performance only

- `projectActual` / `projectExecutionViews` remain the only Actual builders.
- No UI writes to “Actual” calendar items.
- Empty baseline + live Performance rows may still appear on Actual (hotfix behavior on `develop`) — Actual remains Performance-driven.

### R4 — Media Plan does not own commercials

- Quoted revenue on slate is display/allocation context only.
- Authoritative PO amounts live on Assignments after convert.
- If slate budget ≠ accepted snapshot / Assignment rollup, show a warning banner — do not silently rewrite lines from the plan.

### R5 — Prefer Assignment linkage on schedule items

Schedule items should carry stable references to:

- `campaign_line_id` (Assignment)
- optionally `assignment_deliverable_id` / `assignment_post_schedule_id`

v1 may key primarily by creator/service labels. Release 2.0 migrates toward **ID-linked slots** so Original/Current/Actual join cleanly to VIO/Billing.

---

## 5. Interaction with Quotation convert

```text
Quotation (accepted)
  → Assignments created (scope + tentative dates)
  → Media Plan hydrates / links slots to Assignment IDs
  → Publish → Original (immutable)
  → Draft changes (non-live only) → Current
  → Performance posts → Actual projection
```

Pre-convert Studio work (quote-only hydrate) remains allowed; after convert, **Assignment hierarchy is preferred** for slate seeding (`seed-from-assignment-hierarchy` pattern).

---

## 6. Surface behavior

| Surface | Original | Current | Actual |
|---|---|---|---|
| Studio | Read baseline when comparing | Edit draft tip (guards apply) | Read-only projection |
| Campaign workspace | Tab/view | Tab/view with edit if draft | Tab/view derived |
| Client Portal | Approved Original + decisions | Not exposed as editable tip | R2 portal Actual = later (v1 out-of-scope) |

---

## 7. Compatibility with Media Plan v1 freeze

Media Planning v1 is **feature-frozen** for new product scope. Release 2.0 Media Plan work is limited to:

1. Ownership documentation (this file) — **now**
2. Assignment-ID linkage + non-live edit guards — **after architecture approval**, as explicit R2.0 tasks
3. Portal Actual / Comparison Mode — only if separately approved (still listed as v1 out-of-scope)

Do not reopen general Media Plan feature expansion under this refactor.

---

## 8. Acceptance tests (spec-level)

1. Publishing a baseline prevents in-place mutation of Original items.
2. Moving a date on Current for a live Assignment is rejected (or no-ops with error).
3. Actual view changes when Performance live dates change without editing the plan.
4. After quote convert, Media Plan can resolve creators via Assignment IDs without requiring a second commercial copy from Quotation.
