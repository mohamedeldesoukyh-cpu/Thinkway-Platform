# 10 — Migration Strategy

**Status:** Draft for Product approval  
**Rule:** No implementation until this package is approved  
**Rule:** Presentation / navigation / IA only — no API · DB · workflow · calculation changes

---

## 1. Migration principles

1. **Evolve, don’t rip** — preserve Campaign Baseline, Enterprise Tabs, Financial Display, Deliverables.  
2. **Campaign first** — reference module proves the OS model.  
3. **Functional releases stay unblocked** — Planning Board (2.2a) and Copilot (2.2b) plug into the evolving shell; they must not wait for full platform restyle.  
4. **No parallel permanent systems** — temporary adapters OK; delete when stage complete.  
5. **Measure continuity** — success = operators report one product, not prettier tabs.

---

## 2. Phased plan

### Phase 0 — Approval gate (now)

- [ ] Product approves docs 01–10  
- [ ] Lock non-goals (no logic/API/DB)  
- [ ] Confirm Planning Board / Copilot integrate into process model  

### Phase 1 — Campaign Process Navigation (foundation)

**Goal:** Replace peer-tab mental model inside Campaign Workspace.

| Work | Detail |
|------|--------|
| Evolve Enterprise Tabs | Process semantics: order, current/completed/blocked, optional next CTA |
| Map stages | Existing tab IDs → process stages (Overview…Timeline) |
| Portfolio cues | Add Stage · Health · Next action columns/cards (derive from existing fields) |
| Open behavior | Deep-link to recommended stage |
| Header | Emphasize stage + next action; keep live actions only |
| Demote parallel nav | No stage-jump hero duplication |

**Out of scope for Phase 1:** Full Studio chrome rewrite; Finance/Clients visual merge.

### Phase 2 — Planning cluster continuity

| Work | Detail |
|------|--------|
| Media Plan | Enter via Planning stage; shared campaign crumb/shell language |
| Studio | Same campaign identity; persistent back; reduce `/studio` vs `/ai` confusion |
| Naming | Clarify AI assistant vs Intelligence warehouse |

**Planning Board (2.2a)** ships as Planning-stage capability inside this cluster.

### Phase 3 — AI in context

| Work | Detail |
|------|--------|
| Assist surface | Bound to current campaign/stage context |
| Copilot (2.2b) | Docks into shell; no separate product OS |
| Context payload | Use already-available workspace data (no new domain APIs required for UX wiring) |

### Phase 4 — Platform shell unification

| Work | Detail |
|------|--------|
| Platform Nav | One map; Home shortcuts don’t invent a second system |
| Clients / Vendors / Groups | Adopt process header + process rail patterns |
| Finance hubs | Document lifecycle chrome alignment |
| Token convergence | Reduce V6 vs Aurora vs Studio divergence |

### Phase 5 — Portfolio OS maturity

| Work | Detail |
|------|--------|
| Cross-module origin crumbs | “Opened from TW-…” |
| Lifecycle heuristics | Richer next-action rules (still presentation) |
| Discovery context links | Campaign-aware entry/return |

---

## 3. Compatibility with Campaign Module Baseline

| Baseline pillar | Migration treatment |
|-----------------|---------------------|
| Campaign IA | Extended (process narrative), not discarded |
| Persistent shell | Strengthened |
| Enterprise Tabs | Evolved → Business Process Navigation |
| Financial Display | Unchanged |
| Deliverables selection | Unchanged |
| Hidden Planning Board / Copilot until live | Unchanged |

If any phase requires reopening visual freeze scope, Product must approve explicitly.

---

## 4. Risk register

| Risk | Mitigation |
|------|------------|
| Process rail feels like a wizard | Allow skip-ahead; show all stages |
| Studio rewrite blocks 2.2a | Phase 2 minimum viable continuity only |
| Parallel nav creeps back | Architecture review checklist in PR template |
| Portfolio stage heuristics wrong | Start with conservative mapping; tune |

---

## 5. Definition of done (initiative)

- Portfolio and Workspace feel like one Campaign module  
- Process navigation teaches lifecycle  
- Studio/AI feel in-campaign  
- No duplicate nav systems for same destinations  
- Clients/Finance share the philosophy  
- Docs updated; baseline amended only by approval  

---

## 6. Immediate ask

**Approve Phase 0** (this package).  
Then authorize **Phase 1 only** before broader Studio/platform work.
