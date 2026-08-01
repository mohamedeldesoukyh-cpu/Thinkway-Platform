# Campaign Workspace Baseline v1.3 (Business Narrative & Operational Compliance)

**Status:** Protected implementation baseline — **canonical · frozen**  
**Milestone:** Release 2.2c — Decision Center Business Narrative & Operational Compliance  
**Product Acceptance:** Passed · Final Product Acceptance Gate · 2026-08-01  
**Class:** Governance — **Campaign Workspace v1.3 is the canonical implementation baseline**  
**Supersedes:** [`CAMPAIGN_WORKSPACE_BASELINE_V1.2.md`](./CAMPAIGN_WORKSPACE_BASELINE_V1.2.md)  
**Historical:** [`CAMPAIGN_WORKSPACE_BASELINE_V1.1.md`](./CAMPAIGN_WORKSPACE_BASELINE_V1.1.md) · [`CAMPAIGN_WORKSPACE_BASELINE_V1.md`](./CAMPAIGN_WORKSPACE_BASELINE_V1.md)  
**Parent baselines:**  
[`THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`](./THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md) ·  
[`BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md`](./BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md) ·  
[`CAMPAIGN_MODULE_BASELINE.md`](./CAMPAIGN_MODULE_BASELINE.md)  
**Compliance:** [`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md)  
**Regression (mandatory / protected):** `npm run test:campaign-workspace-lifecycle-os`

> **Freeze tip on `origin/develop`:** `84ef254c` — `feat(campaign): Decision Center business narrative and operational compliance`

---

## Canonical statement

**Campaign Workspace v1.3 is the canonical implementation baseline.**

The Campaign Workspace remains the **Lifecycle Operating System**. Release 2.2c refined the Decision Center into an **executive briefing** with three severity levels and correct Vendor IO operational-compliance semantics — **without** redesigning navigation, BPN, lifecycle stage policy tables, APIs, database, permissions, workflows, or calculations.

v1.3 **inherits all v1.2 invariants** and adds the rules below.

---

## Final Product Acceptance (passed)

| Gate | Result |
|------|--------|
| One coherent business story | Pass — dependency chain + story-filtered cards |
| Business vs Operational severity | Pass — only Business Blockers stop progression |
| Vendor IO never pins progression alone | Pass — Operational Attention; campaign may continue |
| No contradictory messaging | Pass — approved Client IO never framed as the problem |
| Collapsible Decision Center | Pass — first visit expanded; later collapsed by default; preference remembered; deep-links expand |
| Large-campaign aggregation | Pass — summary cards; register progressive disclosure |
| Workspace consistency | Pass — Decision Summary → KPIs → Register Summary → Expand → Detail |
| Executive scan (5s / 5m) | Pass — stage · progression · severity · owner · waiting · CTA |
| Operational effort gate | Pass — briefing reduces “what next?” hunting |
| Ops Executive 30-second test | **Yes** — collapsed strip + primary CTA answer what to do next |

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

## What v1.3 freezes (additive to v1.2)

| Capability | Meaning |
|------------|---------|
| **Three severities** | Business Blocker · Operational Attention · Optimization Opportunity — exactly one per issue |
| **Business Blockers only stop progression** | Client approval, PO ceiling, rejected commercial terms, missing mandatory assignments |
| **Vendor IO = Operational Compliance** | Acceptance, manual delivery, missing signed copy, issuance follow-up — never pause lifecycle alone |
| **Executive dependency chain** | Current → Next → Waiting → Impact → Owner/Since → Then (unlocks) |
| **Story-filtered inbox** | One dependency family at the highest severity tier — no unrelated alert dump |
| **Lean object cards** | Object ref · affected · owner · since · CTA (no repeated essays) |
| **Collapsible Decision Center** | First visit expanded; after first visit collapsed by default; `sessionStorage` preference; deep-links force expand |
| **Collapsed executive strip** | Stage · May continue / Cannot advance · waiting · severity · owner · days · primary CTA |

---

## Severity model (protected)

| Level | Stops progression? | Examples |
|-------|--------------------|----------|
| **Business Blocker** | Yes | Client approval pending; Client IO rejected; PO exceeded; no assignments |
| **Operational Attention** | No | Vendor IO acknowledgements; manual delivery; missing signed IO; overdue deliverables; collections follow-up |
| **Optimization Opportunity** | No | Metadata / enrichment / optional reporting (model reserved) |

---

## Deep-link matrix (unchanged from v1.2)

| Query | Target |
|-------|--------|
| `?tab=` | Workspace tab |
| `?io=` | Client IO expand **or** Vendor IO detail sheet |
| `?line=` | Assignment detail |
| `?deliverable=` / `?docsCreator=` | Deliverables |
| `?publication=` | Performance |
| `?approval=` | Workflow |
| `?invoice=` / `?payment=` | Finance |
| `?activity=` | Timeline |

---

## Progressive Disclosure (unchanged philosophy)

- **Decision Center** — collapsible briefing (v1.3)  
- **Lifecycle Details** — collapsed by default  
- **Operational registers** — collapsed by default; tables lazy-render; deep-links force-open  

---

## Mandatory preserve for future Campaign work

1. Preserve **Business Stage SSOT**  
2. Preserve **Decision Center** as the only operational guidance component  
3. Preserve **Lifecycle OS** philosophy  
4. Preserve **three-severity model** and Vendor IO operational-compliance semantics  
5. Preserve **Next Action Journey** (executable, stage-specific, exact-record)  
6. Preserve **Progressive Disclosure** (Decision Center · Lifecycle Details · registers)  
7. Preserve **Workspace-as-View** philosophy  
8. Include Platform Architecture Compliance + operational effort answers on every proposal  
9. Run `npm run test:campaign-workspace-lifecycle-os` before merge  

**Exception:** Formal Architecture Reopen approved by Product.

---

## Technical Debt (recorded — do not implement in this freeze)

1. Browser soak test on a real enterprise campaign (100+ creators / 300+ deliverables / 150+ Vendor IOs / 500+ timeline events).  
2. Portfolio and Notifications adoption of the deep-link query parameters.  
3. Optional `?audit=` deep-link if Finance Audit becomes externally navigable.  
4. Wire Optimization Opportunity cards from campaign-optimization signals when product prioritizes them.  

These are backlog items, not blockers.

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) extended | S00–S16 operational spine (presentation / readiness only) |
| Stakeholder Journey(s) extended | Internal Ops · Commercial · Client · Vendor · Creator · Finance · Executive |
| Business Process component(s) reused | `lib/business-process`; BPN; State Strip; Process Rail; Decision Center |
| Workspace(s) extended | Campaign Workspace (Aurora shell) — narrative / compliance presentation only |
| Baseline documents referenced | Architecture v1.0; BPN Foundation; Campaign Module Baseline; Campaign Workspace Baseline v1.3 |
| No new navigation philosophy | Extends BPN; no parallel guidance/nav system |
| No duplicate workflow | Presentation orchestration over existing campaign signals |
| Lifecycle extension | Business vs operational severity + executive briefing make Lifecycle OS decision-ready |
| Operational effort — eliminated | Hunting across tabs for “what is blocking us?” |
| Operational effort — simplified | One briefing: stage, progression, owner, action |
| Operational effort — remains human | Approvals, creator relationships, commercial judgment |

---

## Next

**Active initiative:** **Release 2.3 — Campaign Planning Workspace**

Must start with (in order):

1. Business Capability Review  
2. Product UX Review  
3. Capability Specification approval  
4. Architecture Compliance review  
5. Implementation  

The Campaign Planning Workspace **must extend** the Campaign Lifecycle OS and Business Process Navigation **without** introducing any new navigation philosophy. It inherits Campaign Workspace Baseline **v1.3**.

Gate documents:

- [`../capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md`](../capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md)  
- [`../capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md`](../capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md)

**Do not perform further Campaign Workspace UX refinement** without Architecture Reopen.
