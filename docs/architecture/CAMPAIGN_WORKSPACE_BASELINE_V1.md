# Campaign Workspace Baseline v1.0 (Lifecycle OS)

**Status:** Historical — **superseded for implementation by v1.1**  
**Canonical baseline:** [`CAMPAIGN_WORKSPACE_BASELINE_V1.1.md`](./CAMPAIGN_WORKSPACE_BASELINE_V1.1.md)  
**Milestone:** Campaign Workspace Lifecycle OS Complete (v1.0)  
**Approved:** 2026-08-01  
**Freeze commits (v1.0):** `e683ad57` · `692adc4f` on `develop`  
**Class:** Historical reference — do not treat as the current implementation baseline  
**Parent baselines:**  
[`THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`](./THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md) ·  
[`BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md`](./BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md) ·  
[`CAMPAIGN_MODULE_BASELINE.md`](./CAMPAIGN_MODULE_BASELINE.md)  
**Compliance:** [`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md)  
**Regression:** `npm run test:campaign-workspace-lifecycle-os`

---

## Definition

The Campaign Workspace is the **Lifecycle Operating System** for Thinkway campaigns.

| Concept | Meaning |
|---------|---------|
| Primary business object | The **Campaign** |
| Source of truth for progress | **Business Stage** |
| User journey default | **Next Action** |
| Workspace tabs | Contextual views into the same campaign — not separate applications |
| Canonical navigation | Business Process Navigation (extends; does not replace) |

This baseline freezes presentation + lifecycle orchestration only. It does **not** redefine APIs, database schema, workflow engines, permissions, or calculation logic.

---

## Business Process Navigation integration

This baseline **extends** the BPN Foundation:

| BPN asset | Campaign Workspace use |
|-----------|------------------------|
| `lib/business-process/` | Shared types, business states, rail signals |
| Process-aware Enterprise Tabs | Process-nav markers + progression cues |
| `campaign-process-presentation.ts` | Stage recommendation + stageSignals |
| Stage summary | Compatibility surface; Lifecycle OS chrome is primary |
| Portfolio continue-into-stage | Deep-link to `nextActionTab` |

**Forbidden:** Introducing a competing navigation philosophy alongside BPN.

---

## Lifecycle OS principles

1. Every screen answers: Where am I? Why? What is missing? Who acts? What is next? When can I move?  
2. Business Stage remains constant while the user changes Workspace.  
3. Next Action is the primary CTA of the campaign.  
4. Status is always explained (requirements, reason, owner, expected outcome).  
5. **Blocked** appears only when stage policy `enforcement === hard`.  
6. Soft issues surface as Waiting / Needs Attention — never as unexplained Blocked.  
7. Empty states explain unlock stage, owner, and next expected event.  
8. New capabilities must plug into the lifecycle (e.g. Planning Board → Planning stage).

---

## Living Campaign Object

The campaign is presented as one continuous business object:

- Identity (document number + name) remains visible in chrome and sticky state strip.  
- Business Stage + Business State remain visible while scrolling and switching workspaces.  
- Waiting For, Days Waiting, and Risk remain available for operational judgment.  
- Workspaces open with a lifecycle summary that reasserts the same campaign context.

---

## Campaign State Strip

**Component:** `features/campaigns/lifecycle/components/campaign-state-strip.tsx`  
**Placement:** Pins with process navigation (scroll shell tabs region).

Always shows:

| Field | Role |
|-------|------|
| Campaign identity | Living object anchor |
| Business Stage | Source of truth |
| State | Draft / Ready / Waiting / In Progress / Needs Attention / Blocked / Completed / Closed |
| Waiting For | Stakeholder posture |
| Days Waiting | Time in waiting/attention posture (presentation heuristic) |
| Risk | On track / Watch / Elevated / Critical / Stalled |
| Workspace | Current view label (navigation only) |
| Next Action CTA | Default journey into `nextActionTab` |

---

## ERP Process Rail

**Component:** `features/campaigns/lifecycle/components/campaign-process-rail.tsx`  
**Styles:** `app/styles/campaign-workspace.css` (`.thinkway-lc-process-rail*`) · process-nav tabs in `enterprise-tabs.css`

Visual language:

- Continuous track + progress fill to current business stage  
- Completed · Current · Waiting · Upcoming · Needs Attention · Blocked  
- Owner on current / full density  
- Never disables navigation (skip-ahead remains allowed)

Enterprise Tabs remain the workspace rail; process markers reinforce progression, not page chrome.

---

## Portfolio Operational Intelligence

**Module:** `features/campaigns/lifecycle/campaign-portfolio-intelligence.ts`  
**Surface:** Campaigns list columns

| Column | Meaning |
|--------|---------|
| Business Stage | Recommended lifecycle stage |
| Waiting For | Stakeholder waiting party |
| Days Waiting | Days in waiting/attention posture |
| Risk | Presentation risk from state + wait duration + end date |
| Next Action | Primary journey deep-link |

All portfolio intelligence is derived from existing list/workspace fields — no new APIs.

---

## Next Action guidance

**Components:** `campaign-next-action-card.tsx` · State Strip CTA · Portfolio Next Action

Must answer:

1. What is the next business action?  
2. Who owns it?  
3. Why is it required?  
4. What happens after it is completed?

Routing: continue / deep-link into `lifecycle.nextActionTab` (same as BPN `entryStageId`).

---

## Workspace consistency rules

| Rule | Requirement |
|------|-------------|
| Campaign primary | Every workspace affirms the same campaign object |
| Business Stage SSOT | Guidance and strip always show business stage, not only the open tab |
| Workspace = view | Labels say “Workspace view”; never imply a separate module |
| Lifecycle summary first | Non-overview workspaces open with `CampaignWorkspaceGuidance` |
| Requirements explained | Overview exposes completed/missing/reason/owner/outcome |
| No competing nav | Do not add parallel tab systems or peer apps inside Campaign |

---

## Business State model

**Module:** `lib/business-process/business-state.ts`  
**Orchestration:** `campaign-lifecycle-orchestrator.ts`

| State | Meaning |
|-------|---------|
| Draft | Just created; little expected |
| Ready | Requirements met; can move |
| Waiting | Waiting on a stakeholder (Client / Vendor / Finance / Creator / Operations) |
| In Progress | Current owner working |
| Needs Attention | Late / missing / warning — still operational |
| Blocked | Hard enforcement prevents progression |
| Completed | Stage/campaign finished |
| Closed | Archived / cancelled |

Stage policy (`campaign-stage-policy.ts`): `mandatory` + `enforcement` (`none` \| `soft` \| `hard`) — data-driven, not hardcoded per screen.

---

## Dimensional Health model

Independent slices (presentation):

- Commercial  
- Operations  
- Delivery  
- Finance  
- Client  
- Performance  

Health is dimensional — not a single opaque traffic light.

---

## Timeline hierarchy

1. **Business Timeline** — campaign journey milestones (primary)  
2. **System activity / finance audit** — secondary, collapsed  

Database update logs must not dominate the Timeline workspace.

---

## Empty State standards

Empty / zero-data screens must explain:

1. Why information is not available yet  
2. Which lifecycle stage unlocks it  
3. Who owns the next action  
4. What the expected next event is  

Examples: Client IO, Vendor IO, Finance payments, Performance publications.

---

## Canonical implementation map

| Concern | Path |
|---------|------|
| Orchestrator | `features/campaigns/lifecycle/campaign-lifecycle-orchestrator.ts` |
| Stage policy | `features/campaigns/lifecycle/campaign-stage-policy.ts` |
| BPN adapter | `features/campaigns/lifecycle/campaign-process-presentation.ts` |
| Portfolio intel | `features/campaigns/lifecycle/campaign-portfolio-intelligence.ts` |
| UI components | `features/campaigns/lifecycle/components/` |
| Workspace shell wiring | `features/campaigns/components/campaign-workspace.tsx` |
| Hero | `features/campaigns/components/aurora/campaign-hero.tsx` |
| Portfolio table | `features/campaigns/components/campaigns-table.tsx` |

---

## Extension rules (mandatory)

Future Campaign Workspace work **must extend** this baseline. It **must not redesign** it.

Applies to Planning Board, Client/Vendor/Creator views, Reporting Hub, Notifications, Analytics, and any campaign-adjacent capability.

1. Campaign remains the primary business object.  
2. Business Stage remains the source of truth.  
3. Workspaces remain contextual views.  
4. Next Action remains the primary user journey.  
5. No competing navigation patterns.  
6. New capabilities extend the lifecycle — they do not bypass it.  
7. Include Platform Architecture Compliance on every proposal.  
8. Run `npm run test:campaign-workspace-lifecycle-os` before merge.

**Exception:** Formal Architecture Reopen approved by Product.

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) extended | S00–S16 operational spine (Overview through Finance/Timeline) |
| Stakeholder Journey(s) extended | Internal Ops · Commercial · Client · Vendor · Creator · Finance · Executive |
| Business Process component(s) reused | `lib/business-process`; process-aware Enterprise Tabs; campaign process adapter; portfolio continue-into-stage |
| Workspace(s) extended | Campaign Workspace (Aurora shell) |
| Baseline documents referenced | Architecture v1.0; BPN Foundation; Campaign Module Baseline |
| No new navigation philosophy | Extends BPN; process rail + state strip reinforce progression |
| No duplicate workflow | Presentation orchestration over existing campaign signals |
| Lifecycle extension | Makes the campaign a living Lifecycle OS so Planning Board and stakeholder views can plug into the same journey |

---

## Next

**Active initiative (review only — no code yet):** Release 2.2a — Campaign Planning Capability (Planning Board).

Planning Board becomes the **Planning stage** of the Campaign Lifecycle and **must inherit** this Campaign Workspace Lifecycle OS without introducing new navigation, layouts, or workflow concepts.

Gate documents (review together before any implementation):

- [`../capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md`](../capabilities/PLANNING_BOARD_CAPABILITY_SPEC.md)  
- [`../capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md`](../capabilities/PLANNING_BOARD_CAPABILITY_REVIEW.md)
