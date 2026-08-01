# Campaign Workspace Baseline v1.2 (Operational Readiness)

**Status:** Protected implementation baseline — **canonical · frozen**  
**Milestone:** Release 2.2c — Campaign Workspace Final UX / Operational Readiness Gate  
**Product Acceptance:** Passed · approved 2026-08-01  
**Class:** Governance — **Campaign Workspace v1.2 is the canonical implementation baseline**  
**Supersedes:** [`CAMPAIGN_WORKSPACE_BASELINE_V1.1.md`](./CAMPAIGN_WORKSPACE_BASELINE_V1.1.md) (v1.1 remains historical; v1.2 is authoritative)  
**Historical:** [`CAMPAIGN_WORKSPACE_BASELINE_V1.md`](./CAMPAIGN_WORKSPACE_BASELINE_V1.md)  
**Parent baselines:**  
[`THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`](./THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md) ·  
[`BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md`](./BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md) ·  
[`CAMPAIGN_MODULE_BASELINE.md`](./CAMPAIGN_MODULE_BASELINE.md)  
**Compliance:** [`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md)  
**Regression (mandatory / protected):** `npm run test:campaign-workspace-lifecycle-os`

> **Freeze tip on `origin/develop`:** `2c88544c` — `feat(campaign): finalize Campaign Workspace Lifecycle OS operational readiness`

---

## Canonical statement

**Campaign Workspace v1.2 is the canonical implementation baseline.**

The Campaign Workspace remains the **Lifecycle Operating System** for Thinkway campaigns. Release 2.2c finalized operational readiness (object-specific Decision Center inbox, progressive register disclosure, exact-record deep-links, denser executive scan, KPI-only workspace banners) **without** redesigning navigation, BPN, lifecycle stages, APIs, database, permissions, workflows, or calculations.

v1.2 **inherits all v1.1 invariants** and adds operational presentation rules below.

---

## Maintenance Mode (Product Governance)

After this freeze, Campaign Workspace is in **Maintenance Mode**.

### Permitted without Architecture Reopen

- Bug fixes  
- Performance improvements  
- Accessibility improvements  
- Copy improvements  
- Additional deep-links  
- Lifecycle extensions that **preserve** this baseline  

### Require Architecture Reopen

- Navigation redesign  
- Workspace redesign  
- Hero redesign  
- Decision Center redesign  
- Lifecycle redesign  
- New guidance systems  
- Parallel navigation concepts  
- Changes that break Business Stage as the Single Source of Truth  

---

## What v1.2 freezes (additive to v1.1)

| Capability | Meaning |
|------------|---------|
| **Operational Decision Center inbox** | Object · ID · waiting · owner · since · reason · impact · unlock · CTA — never generic “Resolve blockers” |
| **Single business narrative** | One explanation per root cause (e.g. Client approval → Vendor IO impact stated once); workspace banners are KPI-only |
| **Object aggregation** | Many pending Vendor IOs / overdue deliverables collapse to summary cards — never dump dozens into Decision Center |
| **Issue preview cap** | Max 3 issue cards visible; `+N additional issues` expands |
| **Progressive register disclosure** | Every ops workspace: header → KPIs → status → actions → **collapsed register**; table lazy-renders on expand |
| **Register session memory** | Expand/collapse persisted per workspace (`sessionStorage`) |
| **Exact-record deep-links** | CTAs open the record via query params (see matrix) |
| **Executive scan** | Stage · health · waiting · days · risk · highest issue · owner · impact · next action without scrolling past explanations |
| **Button sizing system** | Content-width · nowrap · consistent padding/min-height · no clip |

---

## Deep-link matrix (protected)

| Query | Target |
|-------|--------|
| `?tab=` | Workspace tab (always kept; `history.replaceState`) |
| `?io=` | Client IO expand **or** Vendor IO detail sheet |
| `?line=` | Assignment detail sheet |
| `?deliverable=` | Documentation unit by assignment deliverable id |
| `?docsCreator=` | Deliverables creator filter |
| `?publication=` | Performance publication detail |
| `?approval=` | Workflow approval sheet |
| `?invoice=` / `?payment=` | Finance invoice / payment sheets |
| `?activity=` | Timeline activity sheet |

---

## Progressive Disclosure (v1.2)

**Lifecycle Details** (unchanged philosophy): Journey · Unlock · Requirements · Health · Timeline — collapsed by default.  
**Operational registers** (v1.2): Assignments · Client IO · Vendor IO · Deliverables · Performance · Workflow · Finance · Timeline — **tables never render by default**; expand to load.

Deep-links **force-open** the relevant register and detail sheet.

---

## Decision Center (canonical guidance)

**Module:** `features/campaigns/lifecycle/campaign-decision-center.ts`  
**UI:** `campaign-decision-center-panel.tsx`

Must answer within **5 seconds**:

1. What exactly is the issue?  
2. Why is it happening?  
3. Who owns it?  
4. Since when?  
5. What is waiting?  
6. What is the impact?  
7. What action fixes it?  
8. What becomes unlocked afterwards?  

Clear path (no blockers):

> No operational items. Campaign is progressing normally.

Future capabilities **must extend** the Decision Center. Do **not** introduce competing guidance panels.

---

## Single Source of Truth

| Concept | Source |
|---------|--------|
| Primary business object | **Campaign** |
| Progress | **Business Stage** (`lifecycle.businessStageId`) |
| Operational guidance | **`lifecycle.decisionCenter`** |
| Next Action | **`lifecycle.nextAction` / `primaryActionTab` / `primaryFocusQuery`** |
| State / Waiting / Risk | Same `CampaignLifecycleView` (+ portfolio intel helpers) |

**Forbidden:** A workspace recalculating lifecycle independently or introducing a competing guidance panel.

---

## Inherited from v1.1 / v1.0 (still in force)

- Lifecycle OS · Decision Center exclusivity · Smart Blocker Resolver  
- Hard Block ≠ Needs Attention  
- Locked workspace guidance (object-precise)  
- Lifecycle SSOT wiring (single compute in workspace shell)  
- Campaign State Strip · ERP Process Rail · Portfolio intelligence  
- Business State · Dimensional Health · Business Timeline  
- Workspaces as views · Next Action journey  

---

## Extension rules (mandatory)

Future Campaign Workspace work **must extend** v1.2. It **must not redesign** it.

1. Preserve **Business Stage SSOT**  
2. Preserve **Decision Center** as the only operational guidance component  
3. Preserve **Lifecycle OS** philosophy  
4. Preserve **Next Action Journey** (executable, stage-specific, exact-record)  
5. Preserve **Progressive Disclosure** (Lifecycle Details **and** operational registers)  
6. Preserve **Workspace-as-View** philosophy  
7. Include Platform Architecture Compliance on every proposal  
8. Run `npm run test:campaign-workspace-lifecycle-os` before merge  

**Exception:** Formal Architecture Reopen approved by Product.

---

## Technical Debt (recorded — do not implement in this freeze)

1. Browser soak test on a real enterprise campaign (100+ creators / 300+ deliverables).  
2. Portfolio and Notifications adoption of the deep-link query parameters.  
3. Optional `?audit=` deep-link if Finance Audit becomes externally navigable.  

These are backlog items, not blockers.

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) extended | S00–S16 operational spine (presentation / readiness only) |
| Stakeholder Journey(s) extended | Internal Ops · Commercial · Client · Vendor · Creator · Finance · Executive |
| Business Process component(s) reused | `lib/business-process`; BPN; State Strip; Process Rail; Decision Center |
| Workspace(s) extended | Campaign Workspace (Aurora shell) — operational readiness only |
| Baseline documents referenced | Architecture v1.0; BPN Foundation; Campaign Module Baseline; Campaign Workspace Baseline v1.2 |
| No new navigation philosophy | Extends BPN; no parallel guidance/nav system |
| No duplicate workflow | Presentation orchestration over existing campaign signals |
| Lifecycle extension | Operational inbox + progressive registers make Lifecycle OS executive-ready |

---

## Operational effort rule (capability gate)

No future capability may be implemented until its specification answers **how it reduces operational effort**. Every capability specification must explicitly identify:

1. Which **manual tasks are eliminated**  
2. Which **tasks are simplified**  
3. Which **tasks remain human decisions**  

People spend time on decisions and relationships — not administration and repetitive operational work.

---

## Next

**Active initiative:** **Release 2.3 — Campaign Planning Workspace**

Must start with (in order):

1. Business Capability Review  
2. Product UX Review  
3. Capability Specification approval  
4. Architecture Compliance review  
5. Implementation  

The Campaign Planning Workspace **must extend** the Campaign Lifecycle OS and Business Process Navigation **without** introducing any new navigation philosophy. It inherits Campaign Workspace Baseline **v1.2**.

Gate documents (existing Planning Board pack — retargeted as R2.3):

- [`../capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md`](../capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md)  
- [`../capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md`](../capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md)

**Do not perform further Campaign Workspace UX refinement** without Architecture Reopen.
