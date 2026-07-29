# Productivity & Navigation UX Sprint — Implementation Plan

**Status:** Proposal — awaiting approval (no implementation)  
**Date:** 2026-07-30  
**Scope:** Productivity, navigation, editing efficiency only  
**Non-goals:** No changes to Commercial SSOT, Deliverables business rules, Publication, Performance, Finance, or other commercial/finance logic  

---

## 1. Goal

Make daily Account Manager / Campaign Manager work faster:

1. Media Plan history / undo (highest priority)  
2. Studio → Open Campaign  
3. Previous / Next across key entities  
4. Campaign inline editing with dirty/save  

Reuse existing components. Preserve all business rules.

---

## 2. Current-state review (summary)

| Area | Today | Gap |
|---|---|---|
| **Media Plan versions** | SSOT splits **Business Version** (`history` / `v1.0`) vs **Audit** (`auditHistory`). Approval is the bump boundary. Schedule/creator edits mutate tip + audit; do **not** create business versions. Studio has History (Copilot prompt) + CO-level undo. Campaign Media Plan has Compare (baseline/draft), no History panel. | User-facing edit history + session Undo/Redo + restore UX without violating versioning SSOT |
| **Studio → Campaign** | Campaign → Studio is strong. Studio picker campaign cards have “Campaign workspace”. Inside AI/Studio session: no Open Campaign. | One-click Open Campaign from active Studio session |
| **Prev / Next** | None for Quotation / Shortlist / Campaign / VIO / CIO. Filters: operational tables use localStorage; quotation/shortlist filters often in-memory only. | Shared navigator following filtered list context |
| **Campaign edit** | Overview → Edit sheet → immediate server save. Quotation has best dirty/save/`beforeunload` pattern. No SPA leave-blocker. | Inline / staged edit + Save / Cancel + leave guard |

**Key paths**

- Media Plan versioning: `docs/architecture/MEDIA_PLAN_VERSIONING.md`, `features/campaign-outputs/media-plan-versioning.ts`  
- Schedule writes: `update-media-plan-schedule.ts`, `media-plan-mutations.ts`  
- Studio UI: `output-card.tsx`, `studio-outputs-view.tsx`, CO persistence undo  
- Campaign Media Plan: `campaign-media-plan-workspace.tsx`  
- Quotation dirty save: `quotation-manual-save.tsx`  
- Confirm dialogs: `confirm-action-provider.tsx`  

---

## 3. Architecture conflict — Media Plan History (must resolve before build)

### Conflict

Product request: “every meaningful change creates a history snapshot” with View / Compare / Restore, append-only.

Existing SSOT (`MEDIA_PLAN_VERSIONING.md` + release gates):

- Pre-approval edits must **not** create new **business** versions (`v1.1`, etc.).  
- `history[]` = approval / milestone boundary only.  
- Restore of a business version appends a new business version — never mutates past.  
- Tests explicitly reject “revise creates a new version on every edit.”

### Recommended resolution (preserve SSOT)

Implement **two layers** under one History UI (do not dump edits into business `history`):

| Layer | Name in UI | Contents | Restore behaviour |
|---|---|---|---|
| **A. Business versions** | “Versions” | Existing `history` + tip (`v1.0`, `v1.1`…) | Existing append-only restore |
| **B. Edit snapshots** | “Edit history” | New append-only technical snapshots (or enriched `auditHistory` + optional full tip snapshots in CO / dedicated store) | Restore creates a **new tip mutation + new edit-history entry**; if tip is Approved, force revise-fork first (existing rule) |

**Never** bump `versionLabel` / Approval Impact on routine schedule/creator/budget edits.

### Undo / Redo (session)

- In-memory stack for **unsaved / last N local calendar mutations** before persist (design-tool feel).  
- After save: “Undo last save” = restore previous **edit snapshot** (layer B), not rewrite business history.  
- Redo mirrors the stack. Cap stack size (e.g. 50).

### Meaningful change → edit snapshot

On successful persist of: add/remove/change/move creator, deliverable, budget, pricing, dates, quantities, platforms, and other Media Plan mutations already going through revise/schedule paths:

Each entry records: sequence id, actor, timestamp, human summary, affected creator count, pointer to before/after snapshot (or compact delta + tip hash).

---

## 4. Workstreams & plan

### Workstream 1 — Media Plan History & Undo (P0)

**Deliverables**

1. **Edit-history store** (append-only) — prefer extending Campaign Object persistence / Media Plan payload with `editHistory[]` (or parallel table) **separate from** business `history`.  
2. **Snapshot on persist** for schedule + generate/revise mutations (summary + affected creators).  
3. **History panel** on Campaign Media Plan + Studio Media Plan output:  
   - Versions tab (existing business versions)  
   - Edit history tab (new)  
   - View / Compare / Restore (restore = append new edit entry)  
4. **Session Undo / Redo** on calendar editing (pre-save stack) + post-save “undo last edit snapshot” where safe.  
5. Tests: no business-version bump on schedule edit; restore append-only; Approved tip forks before restore-mutate.

**Reuse:** `restoreOutputVersion`, CO version restore, Compare panel patterns, `auditHistory` enrichment.

**Risk:** Snapshot size / performance on large plans → store compact deltas + periodic full snapshots; cap retained edit entries (e.g. 100) with oldest drop policy (document in UI).

---

### Workstream 2 — Studio → Open Campaign (P1)

**Deliverables**

1. Resolve linked `campaignHeaderId` from conversation / Campaign Object / workspace context.  
2. Add **Open Campaign** control in Studio/AI chrome (and recent conversation rows when `workspaceType === "campaign"`).  
3. Navigate to `/campaigns/{id}` (optionally Media Plan tab if context is outputs).

**Reuse:** Studio picker “Campaign workspace” link pattern; `OpenCampaignStudioLauncher` inverse.

**Conflict:** None with business logic. Quotation/Shortlist-origin Studio sessions: Open Campaign only when a campaign header is linked; otherwise hide or offer Open Quotation/Shortlist (same sprint optional stretch).

---

### Workstream 3 — Previous / Next navigation (P1)

**Deliverables**

1. Shared `EntityAdjacentNavigator` component: `← Previous` · label · `Next →`.  
2. List → detail handoff: pass ordered ID list (or query key) via:  
   - `sessionStorage` navigator context set when opening a row from a list, **or**  
   - URL/search params for small lists  
3. Wire into: Quotations, Shortlists, Campaigns, Vendor IO, Client IO.  
4. Respect **current filtered / sorted** order from the list the user came from.  
5. Ends of list: disable Previous/Next appropriately.

**Reuse:** Operational table filter/sort persistence where present; IO `?io=` selection model.

**Conflicts / gaps:**

- Quotation & Shortlist filters are often in-memory → must persist navigator context at click time (snapshot IDs), not re-query without filters.  
- Paginated campaign lists: navigator should use the **loaded filtered ID sequence** (or fetch adjacent by same filter) — decide in build: snapshot page IDs vs full-filter query (recommend snapshot of visible sorted IDs + “load more” later).

**No business rule changes** — navigation only.

---

### Workstream 4 — Campaign inline editing (P1)

**Deliverables**

1. Campaign Overview (header fields only in v1): inline or in-place edit mode without multi-popup loop.  
2. **Local draft state** until Save (quotation-style).  
3. Dirty indicator · Save · Cancel · validation · confirm leave with unsaved changes (`beforeunload` + `useConfirmAction` or Next navigation guard).  
4. Keep Assignments / lines / finance sheets as they are (out of scope for v1 unless trivial).

**Reuse:** `quotation-manual-save` dirty model, `ClientFormSaveBar` / unsaved status, `useConfirmAction`, existing `updateCampaignHeaderAction`.

**Conflict:** None with commercial SSOT if only header/operational display fields already editable today are staged. Do **not** move Master commercial fields into a new unsaved path that bypasses sync/revision gates — those stay on existing Assignment/Quotation paths.

---

## 5. Suggested implementation order

| Phase | Work | Depends |
|---|---|---|
| **0** | Approve this plan + Media Plan two-layer history resolution | — |
| **1a** | Studio Open Campaign (smallest, high value) | 0 |
| **1b** | Entity Prev/Next shell + Campaigns + IOs | 0 |
| **1c** | Prev/Next Quotations + Shortlists (filter snapshot) | 1b |
| **2a** | Media Plan edit-history snapshots + History panel | 0 |
| **2b** | Session Undo/Redo + restore-from-edit-history | 2a |
| **3** | Campaign overview staged inline edit | 0 |

Parallelization: 1a / 1b / 3 can proceed while 2a is designed in detail.

---

## 6. Explicit non-goals

- Commercial SSOT / Finance / Deliverables documentation rules  
- Publication / Performance logic  
- Changing Media Plan **business version** bump rules or Approval Impact  
- Creator/Client portals  
- Bulk Deliverables upload  

---

## 7. Open questions for product

1. **Edit history retention:** Cap at N entries (e.g. 100)? Soft-delete oldest?  
2. **History panel default tab:** Edit history vs Business versions?  
3. **Prev/Next on paginated campaigns:** Navigate only within current page’s filtered IDs, or fetch full filtered set (costlier)?  
4. **Campaign inline v1 field set:** Confirm header fields only (name, dates, AM, team, description, etc.) — exclude line commercials.  
5. **Studio Open Campaign** when session started from Quotation without convert: hide button vs Open Quotation?

---

## 8. Approval gate

**Do not implement until this plan is approved**, especially the Media Plan two-layer history approach (required to avoid breaking `MEDIA_PLAN_VERSIONING.md`).

After approval, implement on `develop` only; Production untouched.
