# 02 — Master Navigation Architecture

**Status:** Draft for Product approval  
**Depends on:** [`01-PLATFORM_UX_ARCHITECTURE.md`](./01-PLATFORM_UX_ARCHITECTURE.md)

---

## 1. One hierarchy (mandatory)

```
Platform Navigation
        ↓
Module Navigation
        ↓
Business Process Navigation
        ↓
Workspace Content
```

**Nothing else** may act as a peer navigation system for the same destinations.

---

## 2. Layer definitions

### L1 — Platform Navigation

**Purpose:** Which enterprise domain am I in?

**Candidates (target IA — names for approval):**

| Domain | Examples |
|--------|----------|
| Home / Overview | Executive pulse |
| Campaigns | Portfolio + workspaces |
| Commercial | IOs, quotations, shortlists |
| Finance | Invoices, collections, treasury |
| Network | Clients, Vendors, Brands, Groups |
| Discovery | Search, match, import |
| Insights | Reports (Intelligence warehouse deferred/clarified) |
| Administration | Users, Ops Center |

**Today’s pain:** Collapsible sidebar + HomeWorkspaceNavTabs (Overview/Finance/Campaigns/Clients) + Discovery topnav = three platform languages.

**Target:** One platform rail (sidebar or equivalent). Home “four pillars” become shortcuts into that map, not a second system.

### L2 — Module Navigation

**Purpose:** Within a domain, which portfolio / register am I in?

Examples:

- Campaigns → Campaign Portfolio  
- Finance → Invoices | Collections | Posting  
- Network → Clients | Vendors  

### L3 — Business Process Navigation

**Purpose:** Within an entity, which **lifecycle stage** am I operating?

This **replaces the browser-tab mental model**.

Implementation note: Prefer **evolving Enterprise Tabs** into a process rail, not inventing a second tab component.

Navigation must educate operational state (see doc 12):

| Signal | Meaning |
|--------|---------|
| Current stage | Focus |
| Completed stages | Done |
| Upcoming stages | Ahead |
| Blocked stages | Cannot proceed |
| Waiting for external party | Client / vendor / creator |
| Waiting for approval | Approval in flight |
| Recommended next action | Primary CTA |

Canonical stage spine: [`12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`](./12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md).

### L4 — Workspace Content

**Purpose:** Operational registers, editors, boards, documents for the current stage.

---

## 3. What must be removed or demoted

| Current affordance | Disposition |
|--------------------|-------------|
| Hero buttons that only jump to stages | Demote — stages live in Business Process Navigation |
| Duplicate “Open X workspace” overflow items | Remove |
| Overview Quick actions / duplicate Open cards as nav | Keep as **lifecycle index** only if they don’t duplicate the process rail destinations without adding status |
| Sidebar Studio + Campaign AI + Hero Studio as three peers | Consolidate into one Campaign-ecosystem entry model |
| Planning Board / Copilot disabled stubs | Stay hidden until shipped (already baseline) |

---

## 4. Persistent context chrome (all entity workspaces)

Always visible while switching stages:

1. Module crumb (e.g. Campaigns / TW-2026-0001)  
2. Entity identity + status  
3. Lifecycle stage indicator  
4. Health summary  
5. Primary KPI band (entity-level)  
6. Business Process Navigation rail  
7. Recommended next action (single primary when clear)

Only L4 content changes.

---

## 5. Studio & AI navigation rules

| Rule | Detail |
|------|--------|
| Studio is not a platform peer of Campaigns | It is a **Campaign ecosystem workspace** (collaborative / media planning authoring) |
| Entry | From Campaign process stage “Planning / Media Plan” or explicit “Open Studio” that preserves campaign crumb |
| Return | Persistent “Back to Campaign” / crumb — not a buried Outputs-only link |
| AI | Operates **in context** of current entity/stage; does not require leaving the module identity |
| Naming | Resolve “Thinkway Intelligence” collision: AI assistant vs warehouse vs Discovery library |

---

## 6. Cross-module continuity

When jumping Campaign → Client IO register → Finance invoice:

- Preserve **origin context** when possible (campaign id in crumb or “Opened from TW-…”)  
- Use shared process chrome language  
- Never reset to an unrelated visual system mid-journey  

---

## 7. Stakeholder entry (same hierarchy)

Internal shell and portal shells may differ in density, but both use:

```
Entry surface → Campaign identity → Process Navigation (scoped) → Content
```

Stakeholder-specific paths: [`11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md`](./11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md).

---

## 8. Approval questions

1. Confirm the four-layer hierarchy is the only allowed nav model.  
2. Confirm Enterprise Tabs evolve into Business Process Navigation (not replaced by a new parallel system).  
3. Confirm Studio/AI are Campaign-ecosystem surfaces, not peer products in Platform Nav.  
4. Confirm portals reuse this hierarchy for Client / Vendor / Creator journeys on the same campaign.
