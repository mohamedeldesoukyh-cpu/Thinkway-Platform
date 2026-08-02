# Studio Capability Contract

**Status:** **FROZEN · Maintenance Mode · COMPLETE** — Permanent Product Constitution for Studio  
**Effective:** Product-approved 2026-08-02  
**Scope:** Campaign Studio — Enterprise Planning Platform  
**Protected baseline includes:** Strategy Engine Foundation · Planning Context Governance · Studio Capability Contract · Mission · Success Criteria · Product Promise · **Release 2.3 Sprint 2 Studio Evolution** (ECI consume-only · Decision Narrative · Decision Impact)  
**Studio Capability Registry note:** This contract + Platform Capability Registry Studio Governance section are the canonical Studio registry surfaces.  
**Related:**  
- Strategy Engine governance — `.cursor/rules/thinkway-strategy-engine-governance.mdc`  
- Studio Capability Contract rule — `.cursor/rules/thinkway-studio-capability-contract.mdc`  
- Platform Architecture v1.0 — `THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`  
- Platform Capability Registry — `PLATFORM_CAPABILITY_REGISTRY.md`  
- Campaign Workspace Baseline v1.3 — `CAMPAIGN_WORKSPACE_BASELINE_V1.3.md`  
- Enterprise Creator Intelligence — `ENTERPRISE_CREATOR_INTELLIGENCE.md`  
- Enterprise Planning Decision Narrative (planning standard — not a Platform Capability) — `ENTERPRISE_PLANNING_DECISION_NARRATIVE.md`  

**Violation of this contract — including Mission, Success Criteria, or Product Promise — requires Architecture Reopen and Product approval before implementation.**

---

## Purpose

Protect Studio from feature drift.

Studio is an **Enterprise Planning Platform**.

Every future Studio capability must fit this contract.

---

## Mission

Studio exists to transform any marketing brief, business objective, or planning request into an explainable, evidence-based, boardroom-ready campaign strategy by orchestrating Thinkway Platform capabilities.

Studio empowers marketers to produce strategies that reflect senior-level planning expertise, reduce planning time from days to minutes, and generate outputs that build client confidence through logic, evidence, commercial reasoning, and presentation quality.

Studio is the Enterprise Planning Platform of Thinkway. It is capability-driven, entry-point agnostic, and designed to enable marketers to start planning from any business artifact while producing one unified Planning Package.

---

## Success Criteria

Studio is successful when a planner can:

- Start from any planning artifact (marketing brief, business objective, AI prompt, creator, creator shortlist, media plan, quotation, campaign, or an empty planning session).
- Build a complete campaign strategy without following a fixed workflow.
- Receive recommendations that are evidence-based, commercially justified, and aligned with campaign objectives rather than simply listing creators.
- Understand and explain every recommendation with clear business logic, supporting evidence, commercial impact, risks, alternatives, and expected business outcomes.
- Generate an executive-ready proposal and presentation suitable for immediate client delivery without requiring manual redesign.
- Produce an execution-ready Planning Package that Campaign Workspace can execute without rework.
- Reduce campaign planning effort from days to minutes while maintaining or improving strategic quality.
- Produce consistent planning quality regardless of the planner's level of experience by embedding enterprise planning best practices into the platform.
- Allow every planning capability to be enabled, disabled, or licensed independently without affecting the overall Studio architecture.
- Deliver outputs that give clients confidence not only in the selected creators, but in the strategy, rationale, commercial justification, and expected campaign value.

Changes to Mission or Success Criteria require **Architecture Reopen** and **Product approval** before implementation.

---

## Studio Product Promise

Studio is not a campaign builder.

Studio is not a creator search tool.

Studio is not a reporting tool.

Studio is the **Enterprise Campaign Planning Platform** of Thinkway.

Every capability implemented in Studio must contribute to one or more of the following outcomes:

- Produce better strategic decisions.
- Increase the measurable business value delivered to the client.
- Reduce operational effort for internal teams.
- Improve the speed of producing enterprise-quality campaign plans.
- Increase client confidence through logic, evidence, explainability, and presentation quality.
- Reuse existing Thinkway Platform capabilities rather than duplicating them.
- Generate Planning Packages that can move directly into Campaign Workspace without rework.

If a new capability does not clearly improve at least one of these outcomes, it should not be implemented in Studio.

Changes to this Product Promise require **Architecture Reopen** and **Product approval**.

---

## Permanent capability categories

### 1. Planning Capabilities — Studio owns

Studio is the owner of planning authoring and planning orchestration.

Examples:

- Campaign Brief  
- Strategy  
- Media Mix  
- Scenario Planning  
- Proposal  
- Presentation  
- Executive Narrative  
- Planning Workflow  
- Planning Collaboration  

Ownership means Studio may define UX, entry points, and Strategy Engine capabilities for these surfaces. Persistent business data for planning artifacts still lives on **canonical Platform objects** (Campaign Object, Media Plan meta, Outputs registry, etc.) — not on a parallel Studio document or Planning Context table. See Strategy Engine Governance.

### 2. Intelligence Capabilities — Studio never owns

Studio **NEVER** owns intelligence engines.

Studio **ONLY** consumes them through registered Platform SSOT APIs.

Examples:

- Enterprise Creator Intelligence  
- Commercial Intelligence  
- Investment Intelligence  
- Audience Intelligence  
- Category Intelligence  
- Performance Intelligence  
- Decision Center  
- Change Impact  

Forbidden: parallel scores, parallel investment engines, Studio-local reinterpretation of Change Impact or Decision Center assessments.

### 3. Shared Platform Services

Neither “Studio-only” nor “Campaign Workspace–only.” Studio and other modules consume/extend the same services.

Examples:

- Media Plan  
- Campaign Object  
- Outputs  
- Workflow  
- Timeline  
- Financial Display  
- Notifications  
- Identity  

Studio must not fork or duplicate these services.

### 4. Execution Capabilities — Studio never owns

**Campaign Workspace owns** execution. Studio never owns execution.

Examples:

- Assignments  
- Client IO  
- Vendor IO  
- Deliverables  
- Performance  
- Finance  

Studio may prepare and hand off a **Planning Package**; Campaign Workspace executes it.

---

## Product gate — every future Studio feature

Before approving any Studio feature, Product must answer:

| Question | Allowed outcomes |
|----------|------------------|
| Does Studio **own** it? | Only if it is a **Planning Capability** (category 1) |
| Does Studio **consume** it? | Expected for **Intelligence** (2) and often **Shared** (3) |
| Is it **shared**? | Must use existing Platform services (category 3) — no Studio fork |
| Does it belong in **Campaign Workspace** instead? | If **Execution** (category 4) → yes; do not build in Studio |

If ownership is unclear, default to **Architecture review** — do not invent a fifth category inside Studio.

---

## Golden Rules

1. **Studio is capability-driven.** Features register as capabilities; they do not invent parallel products.  
2. **Studio is entry-point agnostic.** Any planning entry point may open the same planning experience; entry does not define a separate product.  
3. **Studio never enforces a workflow.** Capabilities may be used in any order; no forced linear planning funnel.  
4. **Studio orchestrates.** Strategy Engine / Planning Context coordinate; they do not become business objects.  
5. **Studio never duplicates intelligence.** Consume Platform intelligence SSOT only.  
6. **Studio never duplicates execution.** Execution remains Campaign Workspace.  
7. **Studio produces Planning Packages.** The durable handoff from planning to execution.  
8. **Campaign Workspace executes Planning Packages.** Execution, IO, deliverables, performance, and finance run there.

---

## Planning Context (orchestration — not a capability category)

Planning Context is an **internal runtime orchestration layer** (Strategy Engine). It is not a Planning Capability artifact, not Shared persistence, and not Execution.

It must never become a database table, CRM object, Studio document, or saved entity, and must never own or duplicate business state.

Permanent rule: `.cursor/rules/thinkway-strategy-engine-governance.mdc`

---

## Relationship to Campaign Workspace

| Concern | Owner |
|---------|--------|
| Planning authoring & orchestration | Studio |
| Planning Package production | Studio |
| Planning Package execution | Campaign Workspace |
| Operational Decision Center / lifecycle OS | Campaign Workspace (Baseline v1.3) |
| Intelligence engines | Platform (Studio consumes) |

There will **never** be a separate Planning Workspace product outside Studio.

---

## Compliance

Every Studio ADR, capability spec, sprint, or PR that adds Studio surface area must:

1. Classify the capability into exactly one of categories 1–4 (or explicitly Shared + consume).  
2. Answer the four Product gate questions.  
3. Cite this contract.  
4. Confirm no duplication of intelligence or execution.  
5. Confirm Planning Context / Strategy Engine remains orchestration-only.  
6. Confirm the capability clearly improves at least one **Product Promise** outcome — otherwise do not implement in Studio.

**Violation requires Architecture Reopen and Product approval.**

---

## Studio Evolution — Release 2.3 Sprint 2 (protected baseline)

**Status:** **FROZEN · Maintenance Mode · COMPLETE** (Product-approved 2026-08-02)

Sprint 2 is the protected Studio Evolution baseline for Studio × Enterprise Creator Intelligence:

| Area | Baseline |
|------|----------|
| Intelligence | Consume ECI only via `loadCreatorIntelligenceBundle` — no parallel Studio intelligence |
| Executive surfaces | Cards · Detail · Strategy Compare · Executive Summary — decision-first language |
| Decision Narrative | [`ENTERPRISE_PLANNING_DECISION_NARRATIVE.md`](./ENTERPRISE_PLANNING_DECISION_NARRATIVE.md) — protected planning standard |
| Decision Impact | Planning explanation only; insufficient evidence stated; no fabricated forecasts |
| Proposal / Presentation | Same narrative order as Studio planning surfaces |

**Maintenance Mode (Sprint 2):** defect / type / build / continuity sync only. No redesign. No further enhancements in this release. No Media Plan / Planning Context / Campaign Workspace / ECI architecture changes.

---

## Approval

| Role | Status |
|------|--------|
| Product | **Approved** 2026-08-02 — FROZEN · Maintenance Mode |
| Product (Sprint 2 Studio Evolution) | **Approved** 2026-08-02 — FROZEN · Maintenance Mode · COMPLETE |
| Architecture | Protected baseline |

**Maintenance Mode:** Extend Studio via capability specs that comply with this contract. Do not redesign Mission, Success Criteria, Product Promise, capability categories, Golden Rules, or the Sprint 2 Studio Evolution baseline without Architecture Reopen.
