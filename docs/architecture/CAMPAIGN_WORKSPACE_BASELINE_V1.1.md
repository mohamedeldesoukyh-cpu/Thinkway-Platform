# Campaign Workspace Baseline v1.1 (Lifecycle OS)

**Status:** Protected implementation baseline — **canonical · frozen**  
**Milestone:** Release 2.2b — Lifecycle OS Refinement (Decision Center)  
**Product Acceptance:** Passed · approved 2026-08-01  
**Class:** Governance — **Campaign Workspace v1.1 is the canonical implementation baseline**  
**Supersedes (presentation refinement):** [`CAMPAIGN_WORKSPACE_BASELINE_V1.md`](./CAMPAIGN_WORKSPACE_BASELINE_V1.md) (v1.0 remains historical; v1.1 is authoritative)  
**Parent baselines:**  
[`THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`](./THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md) ·  
[`BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md`](./BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md) ·  
[`CAMPAIGN_MODULE_BASELINE.md`](./CAMPAIGN_MODULE_BASELINE.md)  
**Compliance:** [`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md)  
**Regression (mandatory / protected):** `npm run test:campaign-workspace-lifecycle-os`

> **Freeze tip:** recorded on the Release 2.2b commit on `origin/develop` (see git history for `feat(campaign): refine Lifecycle OS with Decision Center and operational guidance`).

---

## Canonical statement

**Campaign Workspace v1.1 is the canonical implementation baseline.**

The Campaign Workspace remains the **Lifecycle Operating System** for Thinkway campaigns. Release 2.2b refined operational guidance (Decision Center, Smart Blocker Resolver, progressive disclosure, locked-workspace messaging) **without** redesigning navigation, BPN, lifecycle stages, APIs, database, permissions, workflows, or calculations.

---

## Maintenance Mode (Product Governance)

After this freeze, Campaign Workspace is in **Maintenance Mode**.

### Permitted without Architecture Reopen

- Bug fixes  
- Performance improvements  
- Accessibility improvements  
- Copy improvements  
- Lifecycle extensions that **preserve** this baseline  

### Require Architecture Reopen

- Navigation changes  
- Workspace redesign  
- Hero redesign  
- Lifecycle redesign  
- New operational flows  
- Alternative guidance systems  
- Changes to Decision Center philosophy  

---

## Lifecycle OS v1.1 — what is frozen

| Capability | Meaning |
|------------|---------|
| **Lifecycle OS v1.1** | Presentation + orchestration baseline for the campaign living object |
| **Decision Center** | Only operational guidance component — dynamic blockers, CTAs, unlocks |
| **Smart Blocker Resolver** | Right-side action console (`OperationalDetailSheet`) for executable blockers |
| **Progressive Disclosure** | Secondary lifecycle surfaces under **Lifecycle Details** |
| **Dynamic Lifecycle Guidance** | Per-workspace banners derived from the shared lifecycle object |
| **Hard Block vs Needs Attention** | Distinct concepts; soft enforcement never renders as Blocked |
| **Locked Workspace Guidance** | Action-oriented unlock copy (never generic loading for lifecycle locks) |
| **Lifecycle Details collapse** | Session-persisted open/closed across tab changes |
| **Lifecycle SSOT** | One `CampaignLifecycleView` computed in the workspace shell and reused |
| **Stage-specific Decision Center** | Distinct blockers / actions / unlocks / owners per stage |
| **Dynamic Next Actions** | Verb CTAs that navigate to the exact work workspace |
| **Unlock guidance** | “What will unlock?” after completing the current stage |
| **Vendor IO lifecycle messaging** | Prepared drafts vs Ready to Send vs Blocked (Client approval) |
| **Finance lifecycle messaging** | Create Invoice gated until Billing; unlock = Complete Client IO path |
| **Performance lifecycle messaging** | Metrics unlock after publications go live |

---

## Single Source of Truth

| Concept | Source |
|---------|--------|
| Primary business object | **Campaign** |
| Progress | **Business Stage** (`lifecycle.businessStageId`) |
| Operational guidance | **`lifecycle.decisionCenter`** |
| Next Action | **`lifecycle.nextAction` / `primaryActionTab`** |
| State / Waiting / Risk | Same `CampaignLifecycleView` (+ portfolio intel helpers over it) |

**Forbidden:** A workspace recalculating lifecycle independently or introducing a competing guidance panel.

---

## Decision Center (canonical guidance)

**Module:** `features/campaigns/lifecycle/campaign-decision-center.ts`  
**UI:** `campaign-decision-center-panel.tsx` · wired via Next Action / Hero  

Must answer:

1. Where am I?  
2. What is stopping me?  
3. Who owns the blocker?  
4. What do I do now? (executable verb CTA)  
5. What unlocks after completion?  

When there are no blockers, show a clear-path message (never an empty Decision Center):

> No blockers. Campaign is progressing normally.

Future capabilities **must extend** the Decision Center. Do **not** introduce competing guidance panels.

---

## Smart Blocker Resolver

**Component:** `campaign-blocker-resolver-drawer.tsx`  
**Shell:** `OperationalDetailSheet` (campaign half-panel pattern)

Each blocker is an **action console** item with:

- Status (Hard Block / Needs Attention)  
- Owner  
- Waiting for / waiting time  
- Why  
- Expected result  
- Executable primary action → exact workspace tab  

---

## Progressive Disclosure

**Component:** `campaign-lifecycle-details.tsx`  
**Session key:** `thinkway:campaign-lifecycle-details-open`

Visible immediately: Hero · Journey · KPIs · Workspace  
Collapsed by default: Requirements · Health · Timeline · Expected Outcome (Lifecycle Details)

Operational workspace always starts above the fold. Collapse preference persists for the browser session across tab changes.

---

## Hard Block vs Needs Attention

| Concept | Meaning |
|---------|---------|
| **Hard Block** | `enforcement === hard` (or hard-classified items such as PO exceeded under hard policy) — campaign cannot continue |
| **Needs Attention** | Soft issues, waiting, review required — campaign can continue but requires action |

Soft enforcement **must never** appear as system-stop Blocked.

---

## Locked workspace guidance

Non-overview workspaces use `buildWorkspaceGuidance` over the **same** lifecycle object.

Copy is **action-oriented** (prefer unlock verbs), e.g.:

- Complete Client IO to unlock Billing.  
- Complete Client IO to unlock Vendor IO send.  
- Complete Vendor IO to unlock Deliverables.  
- Publish deliverables to unlock Performance metrics.  

Vendor IO separates **prepared data** from **lifecycle send-readiness**.  
Finance hides/disables Create Invoice until Billing has started.

---

## Lifecycle SSOT wiring

| Concern | Path |
|---------|------|
| Decision Center model | `features/campaigns/lifecycle/campaign-decision-center.ts` |
| Orchestrator | `features/campaigns/lifecycle/campaign-lifecycle-orchestrator.ts` |
| Stage policy | `features/campaigns/lifecycle/campaign-stage-policy.ts` |
| BPN adapter | `features/campaigns/lifecycle/campaign-process-presentation.ts` |
| UI components | `features/campaigns/lifecycle/components/` |
| Workspace shell (single compute) | `features/campaigns/components/campaign-workspace.tsx` |
| Styles | `app/styles/campaign-workspace.css` |

`campaignLifecycleFromWorkspace(workspace)` runs once in the shell; Overview and tabs receive that object — they do not re-derive lifecycle.

---

## Inherited from v1.0 (still in force)

- Campaign State Strip  
- ERP Process Rail / BPN extension  
- Portfolio Operational Intelligence  
- Business State model  
- Dimensional Health  
- Business Timeline hierarchy  
- Empty-state standards  
- Workspaces as views (never separate apps)  
- Next Action as default journey  

---

## Extension rules (mandatory)

Future Campaign Workspace work **must extend** v1.1. It **must not redesign** it.

1. Preserve **Business Stage SSOT**  
2. Preserve **Decision Center** as the only operational guidance component  
3. Preserve **Lifecycle OS** philosophy  
4. Preserve **Next Action Journey** (executable, stage-specific)  
5. Preserve **Progressive Disclosure**  
6. Preserve **Workspace-as-View** philosophy  
7. Include Platform Architecture Compliance on every proposal  
8. Run `npm run test:campaign-workspace-lifecycle-os` before merge  

**Exception:** Formal Architecture Reopen approved by Product.

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) extended | S00–S16 operational spine (presentation refinement only) |
| Stakeholder Journey(s) extended | Internal Ops · Commercial · Client · Vendor · Creator · Finance · Executive |
| Business Process component(s) reused | `lib/business-process`; BPN; State Strip; Process Rail; Decision Center |
| Workspace(s) extended | Campaign Workspace (Aurora shell) — guidance refinement only |
| Baseline documents referenced | Architecture v1.0; BPN Foundation; Campaign Module Baseline; Campaign Workspace Baseline v1.1 |
| No new navigation philosophy | Extends BPN; no parallel guidance/nav system |
| No duplicate workflow | Presentation orchestration over existing campaign signals |
| Lifecycle extension | Decision Center + Resolver make the Lifecycle OS operational for first-day Ops Executives |

---

## Next

**Active initiative (review only — no code yet):** Release 2.2a — Campaign Planning Capability (Planning Board).

Planning Board becomes the **Planning stage** of the Campaign Lifecycle and **must inherit** Campaign Workspace Baseline **v1.1** (Decision Center + Lifecycle OS) without introducing new navigation, layouts, competing guidance, or workflow concepts.

Gate documents:

- [`../capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md`](../capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md)  
- [`../capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md`](../capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md)
