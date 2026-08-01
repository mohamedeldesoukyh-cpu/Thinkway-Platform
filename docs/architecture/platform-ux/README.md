# Thinkway Platform UX & Business Process Architecture Initiative

**Status:** Approved in principle · Stakeholder Journey layer added — awaiting **final** Product approval  
**Updated:** 2026-08-01  
**Class:** Presentation · Navigation · Information Architecture only  
**Implementation:** Forbidden until final approval of this package  

---

## Vision

Thinkway is a **workflow-driven enterprise operating system**, not a page-driven website.

Users must always feel they are progressing through a **business process**, not switching between unrelated applications or browser tabs.

Every stakeholder — Internal Ops, Commercial, Client, Vendor, Creator, Finance, Executive, and AI Assistant — works on the **same campaign** through a journey appropriate to their responsibilities.

---

## Architecture layers

```
Platform UX Architecture
  ├── Business Process Architecture      → shared campaign lifecycle spine
  ├── Master Navigation Architecture     → one nav philosophy
  └── Stakeholder Journey Architecture   → who enters where, same campaign
```

---

## Relationship to existing baselines

This initiative **evolves navigation philosophy**. It does **not** discard:

| Preserve | Reference |
|----------|-----------|
| Campaign Module Baseline | [`../CAMPAIGN_MODULE_BASELINE.md`](../CAMPAIGN_MODULE_BASELINE.md) |
| Campaign Information Architecture | [`../CAMPAIGN_INFORMATION_ARCHITECTURE.md`](../CAMPAIGN_INFORMATION_ARCHITECTURE.md) |
| Financial Display Standard | [`../FINANCIAL_DISPLAY_STANDARD.md`](../FINANCIAL_DISPLAY_STANDARD.md) |
| Enterprise Tabs (evolve → Business Process Navigation) | `components/workspace/enterprise-tabs.tsx` |
| Deliverables selection model | Deliverables documentation SSOT |
| Persistent campaign shell | Campaign workspace scroll shell |
| Product UX Standards | [`../PRODUCT_UX_STANDARDS.md`](../PRODUCT_UX_STANDARDS.md) |
| Calculations, APIs, DB, workflows, permissions | Unchanged |

---

## Document package (final approval before code)

| # | Document | Purpose |
|---|----------|---------|
| 01 | [`01-PLATFORM_UX_ARCHITECTURE.md`](./01-PLATFORM_UX_ARCHITECTURE.md) | Master product UX architecture (+ stakeholder layer) |
| 02 | [`02-MASTER_NAVIGATION_ARCHITECTURE.md`](./02-MASTER_NAVIGATION_ARCHITECTURE.md) | One navigation philosophy |
| 03 | [`03-BUSINESS_PROCESS_ARCHITECTURE.md`](./03-BUSINESS_PROCESS_ARCHITECTURE.md) | Lifecycle-first organization |
| 04 | [`04-MODULE_HIERARCHY.md`](./04-MODULE_HIERARCHY.md) | Module map and ownership |
| 05 | [`05-WORKSPACE_HIERARCHY.md`](./05-WORKSPACE_HIERARCHY.md) | Portfolio → entity → stage → details |
| 06 | [`06-BUSINESS_LIFECYCLE_MODEL.md`](./06-BUSINESS_LIFECYCLE_MODEL.md) | Campaign & adjacent lifecycles |
| 07 | [`07-NAVIGATION_FLOW_DIAGRAMS.md`](./07-NAVIGATION_FLOW_DIAGRAMS.md) | Flow diagrams |
| 08 | [`08-USER_JOURNEY_MAPS.md`](./08-USER_JOURNEY_MAPS.md) | Operator journeys |
| 09 | [`09-PLATFORM_COMPONENT_STANDARDS.md`](./09-PLATFORM_COMPONENT_STANDARDS.md) | Process-oriented component SSOT |
| 10 | [`10-MIGRATION_STRATEGY.md`](./10-MIGRATION_STRATEGY.md) | Phased evolution from current nav |
| 11 | [`11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md`](./11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md) | **NEW** — journeys for all participants on one campaign |

---

## Success criteria (final approval gate)

- [ ] Users feel one connected enterprise platform  
- [ ] Users always know lifecycle stage and next action  
- [ ] Portfolio → Workspace → Studio → AI → Finance feels continuous  
- [ ] Navigation teaches the business process  
- [ ] Every module shares one UX architecture  
- [ ] Every stakeholder journey shares the same campaign identity  
- [ ] Portals / Reporting Hub / AI extend journeys — they do not invent products  
- [ ] New features plug into the workflow + stakeholder model without inventing nav  

---

## Next step

**Final Product approval** of this package (including Stakeholder Journey Architecture).  
Implementation begins only after explicit final approval — Phase 1 first per migration strategy.
