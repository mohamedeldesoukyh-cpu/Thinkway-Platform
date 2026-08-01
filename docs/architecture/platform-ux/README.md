# Thinkway Platform UX & Business Process Architecture Initiative

**Status:** Conditional approval · Campaign Lifecycle Architecture (doc 12) awaiting final freeze approval  
**Updated:** 2026-08-01  
**Class:** Presentation · Navigation · Information Architecture only  
**Implementation:** **Paused** until doc 12 is approved and architectures are frozen  

---

## Vision

Thinkway is a **campaign-centric enterprise operating system**.

Every participant works on the **same campaign** through a stakeholder journey that enters the **canonical Campaign Lifecycle** at different stages.

---

## Architecture layers (freeze set)

```
12  Campaign Lifecycle Architecture     ← highest-level business process SSOT
01  Platform UX Architecture
02  Master Navigation Architecture
03  Business Process Architecture
11  Stakeholder Journey Architecture
```

Supporting: module/workspace hierarchy, diagrams, journeys, components, migration (04–10).

---

## Document package

| # | Document | Purpose |
|---|----------|---------|
| 01 | [`01-PLATFORM_UX_ARCHITECTURE.md`](./01-PLATFORM_UX_ARCHITECTURE.md) | Master UX architecture + campaign-centric principle |
| 02 | [`02-MASTER_NAVIGATION_ARCHITECTURE.md`](./02-MASTER_NAVIGATION_ARCHITECTURE.md) | One navigation philosophy |
| 03 | [`03-BUSINESS_PROCESS_ARCHITECTURE.md`](./03-BUSINESS_PROCESS_ARCHITECTURE.md) | Lifecycle-first organization |
| 04 | [`04-MODULE_HIERARCHY.md`](./04-MODULE_HIERARCHY.md) | Module map |
| 05 | [`05-WORKSPACE_HIERARCHY.md`](./05-WORKSPACE_HIERARCHY.md) | Portfolio → entity → stage |
| 06 | [`06-BUSINESS_LIFECYCLE_MODEL.md`](./06-BUSINESS_LIFECYCLE_MODEL.md) | Practical rail (defers to 12) |
| 07 | [`07-NAVIGATION_FLOW_DIAGRAMS.md`](./07-NAVIGATION_FLOW_DIAGRAMS.md) | Flow diagrams |
| 08 | [`08-USER_JOURNEY_MAPS.md`](./08-USER_JOURNEY_MAPS.md) | Journey narratives |
| 09 | [`09-PLATFORM_COMPONENT_STANDARDS.md`](./09-PLATFORM_COMPONENT_STANDARDS.md) | Component SSOT |
| 10 | [`10-MIGRATION_STRATEGY.md`](./10-MIGRATION_STRATEGY.md) | Phased implementation |
| 11 | [`11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md`](./11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md) | Role journeys on one campaign |
| 12 | [`12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`](./12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md) | **Canonical lifecycle + matrix + ownership** |

---

## Preserve

Campaign Module Baseline · Financial Display · Enterprise Tabs (evolve) · Deliverables selection · Persistent shell · all business logic / APIs / DB.

---

## Freeze gate (after approving doc 12)

- [ ] Campaign Lifecycle Architecture frozen  
- [ ] Platform UX Architecture frozen  
- [ ] Business Process Architecture frozen  
- [ ] Stakeholder Journey Architecture frozen  
- [ ] Phase 1 implementation authorized  

**No code until that gate passes.**
