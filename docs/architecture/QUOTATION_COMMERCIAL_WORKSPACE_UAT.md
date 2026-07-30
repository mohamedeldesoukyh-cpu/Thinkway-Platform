# Quotation Commercial Workspace — UAT Sign-off

**Status:** Preview ready — UAT in progress  
**Type:** Quotation UX workstream (**not** Commercial SSOT Phase 5)  
**Environment:** Development / Preview — `https://dev.thinkwaymedia.com`  
**Branch:** `develop` · Implementation commit `01e4ce8a`  
**Production:** Untouched — Commercial Summary remains; workspace flag stays **OFF** until separate enablement approval  
**Spec:** [`QUOTATION_COMMERCIAL_WORKSPACE.md`](./QUOTATION_COMMERCIAL_WORKSPACE.md)  
**UAT opened:** 2026-07-30  
**Database:** No migrations (flag + UX only)

**Feature flag:** `NEXT_PUBLIC_QUOTATION_COMMERCIAL_WORKSPACE`

| Surface | Expected |
|---|---|
| Development / Preview | **ON** (default when unset) |
| Production | **OFF** (default when unset) |

**Automated gate:** `npm run test:commercial-workspace`

---

## Architecture invariants (must hold)

| Invariant | Status |
|---|---|
| Exactly one commercial editing pipeline | ☐ |
| No bypass of Commercial SSOT / sync service | ☐ |
| Shared draft with Creators Grid | ☐ |
| Explicit Save only (no autosave) | ☐ |
| Session-only Undo/Redo (reset on Save) | ☐ |
| No alternative write paths | ☐ |
| Finance Lock + Commercial Revision respected | ☐ |
| Commercial Audit preserved (+ workspace batch entry) | ☐ |

---

## Automated validation

| Check | Result | Evidence |
|---|---|---|
| `npm run test:commercial-workspace` | ✅ Pass | 13/13 at commit `01e4ce8a` |
| `tsc --noEmit` (workspace-related) | ✅ Pass | Clean before Preview push |
| Preview deploy SHA matches commit | ✅ Pass | Vercel Preview Ready — Branch `develop`, Commit `124f4b4` (feat + UAT pin); tip also includes continuity `f5cff26c` |
| Ops Center → Dev Supabase `hsxrewjcbvmbkqdlzjhs` | ☐ | Confirm in Ops Center during interactive UAT |
| Production flag remains OFF / Summary UI | ✅ Pass | No Production deploy for this workstream; flag defaults OFF when unset on Production |

---

## UAT scenarios

### 1. Editing

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 1.1 | Edit Revenue → live recalc | ☐ | |
| 1.2 | Edit Cost → live recalc | ☐ | |
| 1.3 | Edit GP Input / GP value | ☐ | |
| 1.4 | Edit GP % | ☐ | |
| 1.5 | Edit AF % | ☐ | |
| 1.6 | Edit Currency / FX | ☐ | |
| 1.7 | Quotation totals update while editing (pre-Save) | ☐ | Frozen KPI strip |
| 1.8 | Selection totals when multiple rows selected | ☐ | Selection + Quotation both visible |

---

### 2. Shared Draft

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 2.1 | Creators Grid edit → Workspace reflects immediately | ☐ | |
| 2.2 | Workspace edit → Creators Grid reflects immediately | ☐ | |
| 2.3 | Only one dirty / pending state | ☐ | Manual Save bar |
| 2.4 | One Save persists all pending changes | ☐ | Grid + Workspace |
| 2.5 | Cancel / discard clears staged drafts | ☐ | |

---

### 3. Bulk Operations

Validate each approved op for **one row**, **multiple rows**, and **entire quotation**.

| # | Operation | 1 row | Multi | All | Notes |
|---|---|:----:|:----:|:----:|---|
| 3.1 | Increase Revenue % | ☐ | ☐ | ☐ | |
| 3.2 | Decrease Revenue % | ☐ | ☐ | ☐ | |
| 3.3 | Increase Cost % | ☐ | ☐ | ☐ | |
| 3.4 | Decrease Cost % | ☐ | ☐ | ☐ | |
| 3.5 | Set GP % | ☐ | ☐ | ☐ | |
| 3.6 | Increase GP % | ☐ | ☐ | ☐ | |
| 3.7 | Decrease GP % | ☐ | ☐ | ☐ | |
| 3.8 | Apply Markup % | ☐ | ☐ | ☐ | |
| 3.9 | Apply Discount % | ☐ | ☐ | ☐ | |
| 3.10 | Change Currency | ☐ | ☐ | ☐ | |
| 3.11 | Update FX | ☐ | ☐ | ☐ | |
| 3.12 | Update AF % | ☐ | ☐ | ☐ | |

---

### 4. Undo / Redo

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 4.1 | Multiple sequential edits | ☐ | |
| 4.2 | Undo chain restores prior drafts | ☐ | Session only |
| 4.3 | Redo chain re-applies | ☐ | |
| 4.4 | Save resets session history | ☐ | Not audit/revision |
| 4.5 | Cancel discards staged changes | ☐ | |

---

### 5. Finance Lock (linked campaigns)

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 5.1 | Finance unlocked → normal Save | ☐ | |
| 5.2 | Finance locked → Save blocked | ☐ | |
| 5.3 | Commercial Revision workflow appears | ☐ | |
| 5.4 | No direct write while locked | ☐ | SSOT path only |

---

### 6. Commercial Synchronization

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 6.1 | Unlinked quotation Save | ☐ | |
| 6.2 | Linked quotation Save | ☐ | |
| 6.3 | Confirmation dialog (when applicable) | ☐ | |
| 6.4 | Assignment synchronization | ☐ | |
| 6.5 | Per-line Commercial Audit entries | ☐ | Existing SSOT |
| 6.6 | Workspace batch audit entry on Save | ☐ | `commercial.workspace_saved` |
| 6.7 | Derived fields recalculate correctly | ☐ | |

---

### 7. Quick Analysis & Commercial Health

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 7.1 | Healthy (≥25% GP) | ☐ | Health card click |
| 7.2 | Warning (15%–24.99%) | ☐ | |
| 7.3 | Critical (&lt;15%) | ☐ | |
| 7.4 | Negative GP | ☐ | |
| 7.5 | Low GP / High GP | ☐ | |
| 7.6 | Missing Cost | ☐ | |
| 7.7 | Missing Revenue | ☐ | |
| 7.8 | High Revenue / High Cost | ☐ | Relative to median |

---

### 8. Column configuration & frozen KPIs

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 8.1 | Hide/show columns | ☐ | |
| 8.2 | Preference remembered (localStorage) | ☐ | Per browser/user |
| 8.3 | Frozen Revenue / Cost / GP / GP% while scrolling | ☐ | |

---

### 9. Performance

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 9.1 | 200+ quotation lines — open Workspace | ☐ | |
| 9.2 | Multiple currencies — edits remain responsive | ☐ | |
| 9.3 | Large bulk update | ☐ | |
| 9.4 | Large Undo stack | ☐ | |
| 9.5 | Frequent recalculations feel snappy | ☐ | |

---

### 10. Regression

| # | Area | Result | Notes |
|---|---|:----:|---|
| 10.1 | Commercial SSOT | ☐ | Phase 4 suite still green |
| 10.2 | Deliverables | ☐ | |
| 10.3 | Campaigns | ☐ | |
| 10.4 | Media Plans | ☐ | |
| 10.5 | Productivity & Navigation UX | ☐ | |
| 10.6 | Assignments | ☐ | |
| 10.7 | Finance | ☐ | |
| 10.8 | Publications | ☐ | |
| 10.9 | Performance | ☐ | |
| 10.10 | Production still shows Commercial Summary | ☐ | Flag OFF |

---

## Defects

| ID | Severity | Summary | Status |
|---|---|---|---|
| — | — | None logged yet | — |

Severity guide: **Critical** / **High** / **Medium** / **Low**

---

## Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Product | | | ☐ Pass · ☐ Pass with defects · ☐ Fail |
| Engineering | | | ☐ Automated gates green |

**Feature freeze:** only after Product accepts UAT (defect fixes only thereafter).  
**Production enablement:** separate explicit approval — do **not** set Production flag ON during Preview deploy.

---

## Release governance (this workstream)

```text
develop commit
  → Preview deploy (flag ON by default)
  → UAT
  → Defect fixes
  → Feature Freeze
  → Production approval
  → Enable Production flag only after explicit approval
```
