# 10 ? Migration Strategy

**Status:** FROZEN ? Thinkway Enterprise Platform Architecture v1.0  
**Baseline:** [Thinkway Enterprise Platform Architecture v1.0](../THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md)  
**Rule:** Presentation / navigation / IA only ? no API · DB · workflow · calculation changes

---

## 1. Migration principles

1. **Evolve, don?t rip** ? preserve Campaign Baseline, Enterprise Tabs, Financial Display, Deliverables.  
2. **Campaign first** ? reference module proves the OS model.  
3. **Functional releases stay unblocked** ? Planning Board (2.2a) and Copilot (2.2b) plug into the evolving shell; they must not wait for full platform restyle.  
4. **No parallel permanent systems** ? temporary adapters OK; delete when stage complete.  
5. **Measure continuity** ? success = operators report one product, not prettier tabs.

---

## 2. Phased plan

### Phase 0 ? Approval gate (complete)

- [x] Product approves [`12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`](./12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md)  
- [x] Freeze Platform UX · Business Process · Stakeholder Journey · Campaign Lifecycle architectures  
- [x] Lock non-goals (no logic/API/DB)  
- [x] Confirm Planning Board / Copilot / portals / Reporting / AI map into lifecycle stages  
- [x] Authorize **Phase 1 only**  

### Phase 1 ? Campaign Process Navigation (complete · 2026-08-01)

**Goal:** Replace peer-tab mental model inside Campaign Workspace with operational business progression.

| Work | Detail | Status |
|------|--------|--------|
| Evolve Enterprise Tabs | Lifecycle signals: completed / current / upcoming / waiting_* / blocked / attention_required | Done |
| Map stages | Data-driven process stages (Overview?Finance); reusable business-process model | Done |
| Portfolio cues | Current Stage · Health · Next Action ? continue into current stage | Done |
| Open behavior | Deep-link to recommended business stage (work required); full lifecycle still navigable | Done |
| Header | Stage context: Current Stage, Owner, Status, Next, Waiting For, Expected Action | Done |
| Demote parallel nav | No stage-jump hero duplication; process strip explains state | Done |

**Out of scope for Phase 1:** Full Studio chrome rewrite; Finance/Clients visual merge.

**Implementation notes**

- Reusable layer: `lib/business-process/` + `components/workspace/business-process-stage-summary.tsx`  
- Campaign adapter: `features/campaigns/lifecycle/campaign-process-presentation.ts`  
- Stage set is data-driven so future campaign types may skip/add stages without redesigning navigation philosophy  
- Presentation only ? no API, DB, workflow, permissions, calculations, or server-action changes  

### Phase 2 ? Planning cluster continuity

| Work | Detail |
|------|--------|
| Media Plan | Enter via Planning stage; shared campaign crumb/shell language |
| Studio | Same campaign identity; persistent back; reduce `/studio` vs `/ai` confusion |
| Naming | Clarify AI assistant vs Intelligence warehouse |

**Planning Board (2.2a)** ships as Planning-stage capability inside this cluster.

### Phase 3 ? AI in context

| Work | Detail |
|------|--------|
| Assist surface | Bound to current campaign/stage context |
| Copilot (2.2b) | Docks into shell; no separate product OS |
| Context payload | Use already-available workspace data (no new domain APIs required for UX wiring) |

### Phase 4 ? Platform shell unification

| Work | Detail |
|------|--------|
| Platform Nav | One map; Home shortcuts don?t invent a second system |
| Clients / Vendors / Groups | Adopt process header + process rail patterns |
| Finance hubs | Document lifecycle chrome alignment |
| Token convergence | Reduce V6 vs Aurora vs Studio divergence |

### Phase 5 ? Stakeholder journey continuity (portals & hubs)

| Work | Detail |
|------|--------|
| Client / Creator / Vendor portals | Same campaign identity, stage cues, next action; scoped process rail |
| Reporting Hub | Executive/Ops journey extension on campaign spine |
| Cross-journey attention | ?Waiting on client/vendor/creator? visible to Ops |
| Origin crumbs | ?Opened from TW-?? across Finance and portals |

### Phase 6 ? Portfolio OS maturity

| Work | Detail |
|------|--------|
| Cross-module origin crumbs | Hardened everywhere |
| Lifecycle heuristics | Richer next-action rules (still presentation) |
| Discovery context links | Campaign-aware entry/return |
| Configurable stage sets | Campaign-type-aware lifecycle (skip Vendor IO / Media Buying / etc.) while preserving Architecture v1.0 |

---

## 3. Compatibility with Campaign Module Baseline

| Baseline pillar | Migration treatment |
|-----------------|---------------------|
| Campaign IA | Extended (process narrative), not discarded |
| Persistent shell | Strengthened |
| Enterprise Tabs | Evolved ? Business Process Navigation |
| Financial Display | Unchanged |
| Deliverables selection | Unchanged |
| Hidden Planning Board / Copilot until live | Unchanged |

If any phase requires reopening visual freeze scope, Product must approve explicitly.

---

## 4. Risk register

| Risk | Mitigation |
|------|------------|
| Process rail feels like a wizard | Allow skip-ahead; show all stages; never disable navigation |
| Studio rewrite blocks 2.2a | Phase 2 minimum viable continuity only |
| Parallel nav creeps back | Architecture review checklist in PR template |
| Portfolio stage heuristics wrong | Business-rule priority; tune with ops feedback |
| Static stage set blocks campaign types | Keep stage definitions data-driven (Phase 6) |

---

## 5. Definition of done (initiative)

- Portfolio and Workspace feel like one Campaign module  
- Process navigation teaches lifecycle  
- Studio/AI feel in-campaign  
- No duplicate nav systems for same destinations  
- Clients/Finance share the philosophy  
- Docs updated; baseline amended only by approval  

---

## 6. Authorization status

**Phase 0 approved and frozen (2026-08-01).**  
**Phase 1 complete (2026-08-01).**  
**Phase 2+ gated** until Product authorizes the next migration phase.
