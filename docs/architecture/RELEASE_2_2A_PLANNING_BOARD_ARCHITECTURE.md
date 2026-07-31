# Release 2.2a — Media Plan Planning Board Architecture

**Status:** ✅ **APPROVED** (Product 2026-07-31) · ⏳ **Implementation queued** until Release 2.2 Client IO reaches Feature Freeze  
**Parent:** [`ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md`](./ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md)  
**Depends on:** Release 2.1 — Media Plan ↔ Assignment Hardening (`v2.1.0`)  
**Sibling (in progress first):** Release 2.2 — Client IO — [`RELEASE_2_2_IMPLEMENTATION.md`](./RELEASE_2_2_IMPLEMENTATION.md)  
**Follow-on:** Release 2.2b — AI Copilot for Media Plan Scheduling (§8)

---

## 0. Executive verdict

Release 2.2a adds a **Commercial Workspace–style planning surface** for Media Plan scheduling at 300–1,000 creator scale. It is **not** a second planner and **not** a new operational ledger.

```
Campaign Header
  → Media Plan (campaign_objects)
  → Assignments (campaign_lines + deliverables + posts)
       ↓
  Calendar · Planning Board · Timeline · Actual · Remaining
```

All views read/write the **same Assignment-backed schedule** through the **same mutation engine** used by the calendar today.

**Recommendation:** Implement Phase 1 (MVP) only. Defer Copilot to **2.2b**. Do not expand Release 2.2 (Client IO) scope.

---

## 1. Architecture principles (fixed)

### 1.1 One source of truth

Planning Board is another **view** of existing Assignments. No parallel schedule store.

### 1.2 No new operational tables

Reuse:

| Asset | Role |
|---|---|
| `campaign_lines` | Assignment identity |
| `assignment_deliverables` / `assignment_post_schedule` | Deliverable / post grain |
| Media Plan schedule JSON + engine services | Calendar / board schedule |
| `updateMediaPlanSchedule` (and grain guards) | Single mutation path |
| `audit_logs` + Enterprise Timeline contract | Audit spine |

No synchronization layer. No duplicated state.

### 1.3 Same mutation engine

Every Calendar or Planning Board interaction must call the **same scheduling service** so validation, locks, and business rules have one enforcement point:

- live / billing-locked / plan-locked grain guards (R2.1)
- campaign window constraints
- Assignment ID stamping

### 1.4 Commercial Workspace UX

Intentionally mirror Commercial Workspace:

- fullscreen workspace / popup
- navigation, filters, search
- bulk selection (checkbox / Shift / Ctrl)
- virtualization + pagination
- keyboard shortcuts where applicable
- familiar toolbar / side-panel patterns

---

## 2. Programme sequencing (approved)

| Release | Objective | Scope rule |
|---|---|---|
| **2.2** | Client IO Enterprise Completion | **No expansion** — CIO amendments, milestones, approval |
| **2.2a** | Media Plan Planning Board | Ops UX on Assignment model (this doc) |
| **2.2b** | AI Copilot for Media Plan Scheduling | NL → same mutation pipeline + Review Mode |

---

## 3. Release 2.2a scope — Phase 1 (MVP)

### 3.1 In scope

| Capability | Notes |
|---|---|
| Fullscreen Planning Board entry from Media Plan | Tab or “Planning Board” launcher |
| Commercial Workspace layout | Left creators / right date columns |
| Creator search + filtering | Virtualized list |
| Date-column board | Creators under assigned publishing dates |
| Drag & drop between dates | Single creator/slot |
| Multi-select + multi-drag | Checkbox / Shift / Ctrl |
| Deliverable expansion | Per-creator expand |
| Deliverable-level move | e.g. Story without Reel |
| Bulk Move | Toolbar → target date |
| Calendar / Actual / Remaining sync | Same data — no sync jobs |
| Timeline audit | Every schedule change → `audit_logs` |
| Grain-lock validation | Reuse R2.1 guards |

### 3.2 Deferred (not 2.2a unless already reusable)

| Capability | Target |
|---|---|
| AI Copilot | **2.2b** |
| Duplicate | Later / reuse if engine already supports |
| Delete | Later / reuse if engine already supports |
| Assign User | Later |
| Change Status | Later |
| New scheduling intelligence | Later |

---

## 4. UX contract (MVP)

### 4.1 Entry

From Media Plan workspace (alongside Original / Actual / Remaining / Calendar):

- **Planning Board** → fullscreen workspace (Commercial Workspace pattern)

### 4.2 Layout

| Region | Content |
|---|---|
| Left | Creators — columns e.g. Creator · Platform · Deliverables · Status; search/filter/scroll/virtualize |
| Right | Date columns (publishing board); creators/slots under assigned dates |

### 4.3 Interactions

- Drag creator → date → updates Assignment publishing date via shared mutation path  
- Expand creator → drag individual deliverable  
- Multi-select → Bulk Move → target date  
- Instant reflection on Calendar / Remaining / Actual / Timeline (shared state)

---

## 5. Data & service contract

| Concern | Rule |
|---|---|
| Identity | Prefer `campaignLineId` → deliverable → post (R2.1); never label-only joins for writes |
| Writes | Only through existing Media Plan schedule mutation + guards |
| Reads | Same loaders / projections as Campaign Media Plan |
| Audit | Emit Enterprise Timeline events (schedule move / bulk move) with old/new dates, actor, timestamp |
| Commercial / Finance | Untouched |

---

## 6. Exit criteria (2.2a complete only when)

1. Smooth handling of **300–1,000** creator campaigns (virtualization + pagination budgets).  
2. Consistent drag-and-drop behaviour.  
3. Accurate bulk operations.  
4. **Identical results** whether changes originate from Calendar or Planning Board.  
5. Full audit logging for all scheduling changes.  
6. **No regressions** in existing Media Plan experience (Original / Actual / Remaining / approve-lock / grain guards).

---

## 7. Non-goals

- New Assignment / Media Plan / Timeline tables  
- Background sync or dual-write to a board-specific store  
- Redesign of Commercial SSOT, Convert, CIO, VIO, Billing  
- Shipping Copilot inside 2.2a  
- Expanding Release 2.2 Client IO scope

---

## 8. Release 2.2b — AI Copilot (approved follow-on)

**Status:** Approved as separate release after 2.2a is stable.  
**Dependency:** Planning Board + Assignment mutation path from 2.2a / 2.1.

### 8.1 Pipeline (mandatory)

```
Natural Language
  → Intent Parser
  → Assignment Resolver
  → Validation Engine
  → Scheduling Service   ← same as Calendar / Board
  → Timeline Audit
  → UI Refresh
```

AI **never** manipulates the UI or writes parallel state.

### 8.2 Validation before mutate

- creator exists  
- assignment exists  
- destination date valid (campaign window)  
- not plan-/grain-/billing-locked  
- campaign not completed  

If blocked → return reason; no write.

### 8.3 AI Review Mode (required)

Before execution, present a confirmation card, e.g.:

- single move: creator, old/new dates, deliverables affected, Timeline preview → Confirm / Cancel  
- bulk: N found, N will move, locked/billing-locked excluded → Confirm / Cancel  

### 8.4 Audit

Every confirmed AI action → Enterprise Timeline (e.g. “AI schedule update”) with old/new dates, user, timestamp.

---

## 9. Implementation kickoff (next gate)

When Product authorizes coding for 2.2a:

1. Architecture validation checklist vs codebase (Commercial Workspace reuse map, schedule action surface).  
2. Implementation package (files, tests, UAT).  
3. Dev-first on `develop`; no Production until explicit approval.

**Coding has not started.** This document freezes principles and scope only.

---

## 10. Governance snapshot

| Gate | Status |
|---|---|
| R2.1 Production | ✅ Complete |
| R2.2 Client IO | ✅ Remains NEXT / no scope expansion |
| R2.2a Planning Board principles + MVP scope | ✅ **Approved** |
| R2.2b Copilot principles | ✅ **Approved** (deferred implementation) |
| 2.2a Implementation | ⛔ Pending kickoff approval |
| Production (2.2a / 2.2b) | ⛔ Blocked until their own gates |
