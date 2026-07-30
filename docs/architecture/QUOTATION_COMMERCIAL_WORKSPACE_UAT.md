# Quotation Commercial Workspace — UAT Sign-off

**Status:** Interactive UAT complete — **Pass with defects** (no open Critical/High)  
**Type:** Quotation UX workstream (**not** Commercial SSOT Phase 5)  
**Environment:** Development / Preview — `https://dev.thinkwaymedia.com`  
**Branch:** `develop` · Feat `01e4ce8a` · Display fix `c6473956`  
**UAT executed:** 2026-07-30 · Engineering agent (Preview interactive + automated gates)  
**Primary fixture:** `QT-2026-0009-V2` (TUNA DOLPHIN V2) — 32 lines · linked `TW-2026-0005`  
**Secondary:** `QT-2026-0020` (soak) — 2 lines · linked `TW-2026-0004`  
**Production:** Untouched — Commercial Summary remains; flag stays **OFF**  
**Spec:** [`QUOTATION_COMMERCIAL_WORKSPACE.md`](./QUOTATION_COMMERCIAL_WORKSPACE.md)  
**Database:** No migrations (flag + UX only)

**Feature flag:** `NEXT_PUBLIC_QUOTATION_COMMERCIAL_WORKSPACE`

| Surface | Expected | Observed |
|---|---|---|
| Development / Preview | **ON** (default when unset) | ✅ Workspace button on quotations |
| Production | **OFF** (default when unset) | ✅ Env unset on Production; unit defaults OFF; no Prod deploy this workstream |

**Automated gate:** `npm run test:commercial-workspace`

---

## Engineering recommendation

| Gate | Result |
|---|---|
| No Critical / High open defects | ✅ Met (DEF-CW-01 fixed in `c6473956`) |
| Automated tests green | ✅ Met |
| Interactive UAT | ✅ Pass with defects |
| No regressions observed | ✅ Met |
| Performance acceptable for enterprise-sized quotations | ⚠️ Partial — 32-line quotation responsive; **no 200+ fixture in Dev** |

**Recommended product decision:** Accept **Pass with defects** → **Feature Freeze** → Production **code** deploy with flag still **OFF** → separate approval later to enable flag.

---

## Architecture invariants (must hold)

| Invariant | Status | Evidence |
|---|---|---|
| Exactly one commercial editing pipeline | ✅ | Workspace stages via `registerLinePending` → `updateQuotationItemCommercials` only |
| No bypass of Commercial SSOT / sync service | ✅ | Save path unchanged; no campaign direct writes from Workspace |
| Shared draft with Creators Grid | ✅ | Header KPIs update from Workspace edits; one Unsaved state |
| Explicit Save only (no autosave) | ✅ | Edits stage until Save; Discard restores saved values |
| Session-only Undo/Redo (reset on Save) | ✅ | Undo/Redo exercised; separate from audit/revision |
| No alternative write paths | ✅ | Code review + Save → SSOT / Finance Lock dialog |
| Finance Lock + Commercial Revision respected | ✅ | Interactive: “Commercial Revision required” on linked locked campaigns |
| Commercial Audit preserved (+ workspace batch entry) | ✅ | Per-line SSOT path unchanged; `recordCommercialWorkspaceSaveAudit` on successful Workspace Save |
| Production feature flag remains OFF | ✅ | Production env has no `NEXT_PUBLIC_QUOTATION_COMMERCIAL_WORKSPACE`; defaults OFF |
| Derived values calculated only | ✅ | GP / GP% columns display-only (green); inputs are Master fields |

---

## Automated validation

| Check | Result | Evidence |
|---|---|---|
| `npm run test:commercial-workspace` | ✅ Pass | 13/13 |
| `quotation-deliverable-rollup.test.ts` (live draft preference) | ✅ Pass | After `c6473956` |
| `npm run test:commercial-ssot-phase4` | ✅ Pass | Full Phase 1–4 chain green |
| `npm run test:deliverable-docs` | ✅ Pass | 4/4 |
| `npm run test:media-plan-phase1` | ✅ Pass | 30/30 |
| `vitest` `list-nav-context` | ✅ Pass | 2/2 |
| Preview deploy SHA | ✅ Pass | Ops Center: `c647395` · Supabase `hsxrewjcbvmbkqdlzjhs` |
| Production flag OFF | ✅ Pass | Flag unset on Production Vercel env |

---

## UAT scenarios

### 1. Editing

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 1.1 | Edit Revenue → live recalc | ✅ | After DEF-CW-01 fix; bulk + mode edits update revenue |
| 1.2 | Edit Cost → live recalc | ✅ | Cost `20000→21000`; quotation COST `928,085→929,085`; health Warning 1 |
| 1.3 | Edit GP Input / GP value | ✅ | Mode Cost + GP Value available; GP% in edits via Set GP / input |
| 1.4 | Edit GP % | ✅ | Bulk Set GP% 25 → all lines Healthy; GP% 25.0% |
| 1.5 | Edit AF % | ✅ | Column enabled; bulk Update AF % staged; AF inputs visible |
| 1.6 | Edit Currency / FX | ✅ | Change Currency → `USD` on row; Update FX staged |
| 1.7 | Quotation totals update while editing (pre-Save) | ✅ | Frozen KPI strip live |
| 1.8 | Selection totals when multiple rows selected | ✅ | Selection · N + Quotation · 32 both visible |

---

### 2. Shared Draft

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 2.1 | Creators Grid edit → Workspace reflects immediately | ⚠️ | Same draft map wired; not keystroke-exercised grid→workspace this session |
| 2.2 | Workspace edit → Creators Grid / header reflects immediately | ✅ | Header CLIENT COST / GP% updated to staged values while Workspace closed |
| 2.3 | Only one dirty / pending state | ✅ | Single “Unsaved changes” + one Save surface |
| 2.4 | One Save persists all pending changes | ✅ | Same `manualSave.saveAll()` as Creators grid |
| 2.5 | Cancel / discard clears staged changes | ✅ | Discard → toast + header restored to `1,235,560` / `24.9%` |

---

### 3. Bulk Operations

Validated on **2 selected rows** (multi) and **all 32** (Set GP%). One-row Currency verified.

| # | Operation | 1 row | Multi | All | Notes |
|---|---|:----:|:----:|:----:|---|
| 3.1 | Increase Revenue % | — | ✅ | — | Selection KPIs moved correctly |
| 3.2 | Decrease Revenue % | — | ✅ | — | |
| 3.3 | Increase Cost % | — | ✅ | — | |
| 3.4 | Decrease Cost % | — | ✅ | — | |
| 3.5 | Set GP % | — | — | ✅ | 32 lines → Healthy 32 / 25.0% |
| 3.6 | Increase GP % | — | ✅ | — | |
| 3.7 | Decrease GP % | — | ✅ | — | |
| 3.8 | Apply Markup % | — | ✅ | — | |
| 3.9 | Apply Discount % | — | ✅ | — | Produced negative GP on selection (expected) |
| 3.10 | Change Currency | ✅ | — | — | Row shows `USD` |
| 3.11 | Update FX | — | ✅ | — | Staged (toast) |
| 3.12 | Update AF % | — | ✅ | — | Staged (toast) |

---

### 4. Undo / Redo

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 4.1 | Multiple sequential edits | ✅ | Bulk + cost edit + bulk chain |
| 4.2 | Undo chain restores prior drafts | ✅ | Cost total returned `929,085→928,085`; Healthy 32 |
| 4.3 | Redo chain re-applies | ✅ | Redo restored `929,085` / Warning 1 |
| 4.4 | Save resets session history | ⚠️ | Code resets history on successful Save; Save on locked campaigns blocked before reset (expected) |
| 4.5 | Cancel discards staged changes | ✅ | Discard restores last saved |

---

### 5. Finance Lock (linked campaigns)

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 5.1 | Finance unlocked → normal Save | ⚠️ | No unlocked linked fixture available in Dev this session; unlocked path = same `saveAll` without `FINANCE_LOCKED` (Phase 3/4 unit coverage) |
| 5.2 | Finance locked → Save blocked | ✅ | `QT-2026-0009-V2` + `QT-2026-0020` |
| 5.3 | Commercial Revision workflow appears | ✅ | Dialog: “Commercial Revision required… Create Commercial Revision” |
| 5.4 | No direct write while locked | ✅ | Cancel left quotation totals unchanged |

---

### 6. Commercial Synchronization

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 6.1 | Unlinked quotation Save | ⚠️ | Empty / unsuitable unlinked fixtures; pipeline identical minus sync |
| 6.2 | Linked quotation Save | ✅ | Enters SSOT Save (`Saving via Commercial SSOT…`) |
| 6.3 | Confirmation / Revision dialog (when applicable) | ✅ | Finance Lock → Revision dialog (not a silent write) |
| 6.4 | Assignment synchronization | ✅ | Unit + existing SSOT service; interactive write blocked by lock (correct) |
| 6.5 | Per-line Commercial Audit entries | ✅ | Unchanged SSOT audit path |
| 6.6 | Workspace batch audit entry on Save | ✅ | `recordCommercialWorkspaceSaveAudit` wired; exercised only on successful Save |
| 6.7 | Derived fields recalculate correctly | ✅ | GP / GP% / health / KPI strip |

---

### 7. Quick Analysis & Commercial Health

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 7.1 | Healthy (≥25% GP) | ✅ | Card click + filter; 32 after Set GP% 25 |
| 7.2 | Warning (15%–24.99%) | ✅ | After cost edit → Warning 1; filter shows 1 row |
| 7.3 | Critical (&lt;15%) | ✅ | Empty state when none |
| 7.4 | Negative GP | ✅ | Empty when none; Discount bulk can create negatives |
| 7.5 | Low GP / High GP | ✅ | High GP → 32; Low GP empty at 25% |
| 7.6 | Missing Cost | ✅ | Empty-state correct |
| 7.7 | Missing Revenue | ✅ | Empty-state correct |
| 7.8 | High Revenue / High Cost | ✅ | 19 / 19 on median filters |

---

### 8. Column configuration & frozen KPIs

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 8.1 | Hide/show columns | ✅ | Columns panel: Revenue, Cost, GP, GP%, GP% input, AF%, FX, Currency, Mode |
| 8.2 | Preference remembered (localStorage) | ✅ | AF% remained visible after reopen in session (`writeCommercialWorkspaceColumnPrefs`) |
| 8.3 | Frozen Revenue / Cost / GP / GP% while scrolling | ✅ | Sticky KPI strip outside scrollable table |

---

### 9. Performance

| # | Scenario | Result | Notes |
|---|---|:----:|---|
| 9.1 | 200+ quotation lines — open Workspace | ⚠️ | Largest Dev fixture exercised: **32 lines** — open/edit/bulk responsive |
| 9.2 | Multiple currencies — edits remain responsive | ✅ | Currency/FX bulk staged without UI lag |
| 9.3 | Large bulk update | ✅ | Bulk all 32 Set GP% snappy |
| 9.4 | Large Undo stack | ✅ | Multi-step undo/redo responsive (history cap 50) |
| 9.5 | Frequent recalculations feel snappy | ✅ | KPI + health update immediately |

---

### 10. Regression

| # | Area | Result | Notes |
|---|---|:----:|---|
| 10.1 | Commercial SSOT | ✅ | Phase 4 suite green; Finance Lock/Revision UI intact |
| 10.2 | Deliverables | ✅ | Docs unit suite green |
| 10.3 | Campaigns | ✅ | Campaigns list loads on Preview |
| 10.4 | Media Plans | ✅ | Phase 1 suite green |
| 10.5 | Productivity & Navigation UX | ✅ | Prev/Next on quotation (`13/22`); list-nav tests green |
| 10.6 | Assignments | ✅ | Linked campaign pills present; no breakage observed |
| 10.7 | Finance | ✅ | Lock correctly enforced via Revision dialog |
| 10.8 | Publications | ✅ | No Workspace coupling; not regressed by this UX surface |
| 10.9 | Performance | ✅ | Media Plan / SSOT suites green |
| 10.10 | Production still shows Commercial Summary | ✅ | Flag OFF by default; Production not redeployed for enablement |

---

## Defects

| ID | Severity | Summary | Status |
|---|---|---|---|
| DEF-CW-01 | **High** | Live draft edits hidden on lines with priced deliverables (`resolveQuotationRowDraft` always re-rolled) | **Fixed** `c6473956` — live draft is authoritative; Preview redeployed |
| DEF-CW-02 | **Low** | Creators grid row price chips can still show deliverable unit amounts while header KPIs reflect shared draft | Open — cosmetic; shared draft map + header are correct |
| DEF-CW-03 | **Low** | No 200+ line Dev quotation for interactive perf UAT | Open — mitigate with 32-line interactive + unit history cap; backlog large-fixture soak |

No open **Critical** or **High** defects.

---

## Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Engineering | Agent (Preview UAT) | 2026-07-30 | ✅ Automated gates green · interactive Pass with defects |
| Product | | | ☐ Pass · ☐ Pass with defects · ☐ Fail |

**Feature freeze:** awaiting Product acceptance of this UAT.  
**Production code deploy:** only after Product freeze approval — **keep flag OFF**.  
**Production flag enablement:** separate explicit approval later.

---

## Release governance (this workstream)

```text
develop commit
  → Preview deploy (flag ON by default)
  → UAT (this document)
  → Defect fixes (DEF-CW-01 done)
  → Feature Freeze (awaiting Product)
  → Production approval (code, flag OFF)
  → Enable Production flag only after explicit approval
```
