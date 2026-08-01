# Business Process Navigation Foundation Complete

**Status:** Protected platform baseline  
**Milestone:** Business Process Navigation Foundation Complete  
**Approved:** 2026-08-01  
**Branch tip:** `b8e09927` on `develop`  
**Parent baseline:** [`THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`](./THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md)  
**Migration:** [`platform-ux/10-MIGRATION_STRATEGY.md`](./platform-ux/10-MIGRATION_STRATEGY.md) § Phase 1 — **Complete**

---

## Definition

**Business Process Navigation (BPN)** is the canonical navigation model for Thinkway.

It transitions the Campaign module from page-oriented navigation to **campaign operational progress** while preserving all existing functionality.

| Concept | Meaning |
|---------|---------|
| Single business object | The campaign |
| Single business process | The campaign lifecycle |
| Canonical navigation | Business Process Navigation |
| Forbidden | New navigation models, parallel workflows, or separate-application modules |

---

## What is protected

| Asset | Role |
|-------|------|
| Reusable process model | `lib/business-process/` |
| Stage context UI | `components/workspace/business-process-stage-summary.tsx` |
| Enterprise Tabs process signals | `components/workspace/enterprise-tabs.tsx` (+ CSS) |
| Campaign adapter | `features/campaigns/lifecycle/campaign-process-presentation.ts` |
| Portfolio continue-into-stage | Campaign list Current Stage · Health · Next Action |
| Recommended stage entry | Deep-link to current business stage; full lifecycle remains navigable |

Lifecycle signals (canonical):

- Completed · Current · Upcoming  
- Waiting for Internal Team · Waiting for Client · Waiting for Vendor  
- Blocked · Attention Required  

---

## Extension rules (mandatory)

Future capabilities **must extend** this foundation. They **must not** introduce a new navigation philosophy.

Applies to:

1. Campaign Planning Capability (Release 2.2a)  
2. Media Plan Copilot (Release 2.2b)  
3. Client Collaboration Capability  
4. Vendor Journey  
5. Creator Journey  
6. Reporting Hub  
7. Notifications  
8. Enterprise Analytics  
9. Any future module  

### Rules

1. Integrate into the Campaign Lifecycle (doc 12 stages).  
2. Reuse BPN components (`lib/business-process`, stage summary, process-aware Enterprise Tabs).  
3. Enter via an existing lifecycle stage / process rail item — do not invent a peer app.  
4. Preserve skip-ahead / full-lifecycle navigation (never trap users in a wizard).  
5. Keep presentation/IA changes subordinate to Architecture v1.0 + Campaign Module Baseline.  
6. Include **Platform Architecture Compliance** on every proposal ([`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md)).

**Exception:** Formal Architecture Reopen approved by Product.

---

## Platform principle

> Future modules must integrate into the Campaign Lifecycle instead of introducing new pages or parallel workflows.  
> No module should behave as a separate application.

---

## Posture after this milestone

| Complete | Next |
|----------|------|
| Architecture-first work | Functional delivery |
| Migration Strategy Phase 1 | Capability specs → implementation |
| BPN foundation | Planning Board Capability Spec → Release 2.2a (after approval) |

No additional architecture documents or UX redesign initiatives should start unless a formal Architecture Reopen is approved.
