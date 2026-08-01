# Thinkway Enterprise Platform Architecture v1.0 — Frozen Baseline

**Status:** FROZEN  
**Milestone:** Thinkway Enterprise Platform Architecture v1.0 — Frozen Baseline  
**Approved:** 2026-08-01  
**Branch tip at freeze:** `develop`  
**Class:** Governing product architecture — permanent until formal reopen

---

## Definition

Thinkway is officially defined as:

> **A campaign-centric enterprise operating system built around connected business journeys rather than independent pages, modules, or portals.**

Every participant—

- Internal Operations  
- Commercial  
- Client  
- Vendor  
- Creator  
- Finance  
- Executive  
- AI Assistant  

—works on the **same campaign** through a stakeholder journey that enters the **campaign lifecycle** at different stages.

| Concept | Meaning |
|---------|---------|
| Single business object | The campaign |
| Single business process | The campaign lifecycle |
| Extensions | Navigation, workspaces, approvals, documents, reporting, collaboration, AI |
| Forbidden | Features outside this model; new navigation/workspace/lifecycle philosophies |

---

## Frozen document set

Package root: [`platform-ux/README.md`](./platform-ux/README.md)

| # | Document | State |
|---|----------|--------|
| 01 | Platform UX Architecture | **Frozen** |
| 02 | Master Navigation Architecture | **Frozen** |
| 03 | Business Process Architecture | **Frozen** |
| 04 | Module Hierarchy | **Frozen** |
| 05 | Workspace Hierarchy | **Frozen** |
| 06 | Business Lifecycle Model | **Frozen** |
| 07 | Navigation Flow Diagrams | **Frozen** |
| 08 | User Journey Maps | **Frozen** |
| 09 | Platform Component Standards | **Frozen** |
| 10 | Migration Strategy | **Frozen** (execution plan) |
| 11 | Stakeholder Journey Architecture | **Frozen** |
| 12 | Campaign Lifecycle Architecture | **Frozen** (highest process SSOT) |

Related preserved baselines (still in force):

- [`CAMPAIGN_MODULE_BASELINE.md`](./CAMPAIGN_MODULE_BASELINE.md)  
- [`PRODUCT_UX_STANDARDS.md`](./PRODUCT_UX_STANDARDS.md)  
- [`FINANCIAL_DISPLAY_STANDARD.md`](./FINANCIAL_DISPLAY_STANDARD.md)  
- [`CAMPAIGN_INFORMATION_ARCHITECTURE.md`](./CAMPAIGN_INFORMATION_ARCHITECTURE.md)  

---

## Governance

Every future ADR, Release Architecture document, and implementation proposal **must** include:

**[`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md)**

No release may redefine navigation, workspace, business process, campaign lifecycle, stakeholder journeys, or enterprise UX standards without a **formal architecture reopen**.

---

## Implementation posture

| Allowed | Forbidden without reopen |
|---------|---------------------------|
| Functional delivery extending the baseline | Architectural redesign |
| Migration Strategy phases (authorized sequentially) | New parallel navigation systems |
| Stage-mapped features (Planning Board, portals, etc.) | Separate application experiences |
| Presentation evolution that inherits the baseline | Redefining the campaign lifecycle |

**Phase 1 complete:** Campaign Process Navigation foundation  
([`platform-ux/10-MIGRATION_STRATEGY.md`](./platform-ux/10-MIGRATION_STRATEGY.md) § Phase 1)

### Platform Architecture Compliance — Phase 1

| Item | Statement |
|------|-----------|
| Lifecycle stages affected | S00–S18 presentation cues via practical rail (Overview…Finance/Timeline); heuristics only |
| Stakeholder journeys affected | Internal Ops (primary); cues visible to Commercial/Finance/Executive in portfolio |
| Workspace(s) extended | Campaign Portfolio + Campaign Workspace (Enterprise Tabs → process nav) |
| Baseline documents referenced | Architecture v1.0 docs 01–12; Campaign Module Baseline; Financial Display |
| No new navigation philosophy | Evolves Enterprise Tabs into Business Process Navigation; no parallel tab system |
| No duplicate workflow | Derives stage/health/next action from existing fields; no new workflow engine |
| Lifecycle extension | Teaches the campaign lifecycle in list + workspace; deep-links recommended stage |

---

## Success criteria

Users experience Thinkway as:

1. One connected enterprise operating system  
2. One campaign-centric business platform  
3. One consistent navigation model  
4. One consistent enterprise design language  
5. One connected campaign lifecycle  
6. Multiple stakeholder journeys on the same process  

Users should never feel they are switching between unrelated pages or different applications.

---

## Closing statement

**Future work extends the baseline. It does not redefine it.**
