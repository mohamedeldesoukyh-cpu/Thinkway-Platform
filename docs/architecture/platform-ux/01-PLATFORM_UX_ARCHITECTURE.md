# 01 — Thinkway Platform UX Architecture

**Status:** FROZEN — Thinkway Enterprise Platform Architecture v1.0
**Baseline:** [Thinkway Enterprise Platform Architecture v1.0](../THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md)
**Initiative:** Platform UX & Business Process Architecture  
**Campaign lifecycle SSOT:** [`12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`](./12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md)  
**Stakeholder journeys:** [`11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md`](./11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md)  
**Constraints:** No API · DB · workflow engine · calculation · permission changes

---

## 0. Campaign-centric operating system principle

> Thinkway is not a collection of pages, modules, or portals. It is a campaign-centric enterprise operating system. Every participant—internal teams, clients, vendors, creators, finance, executives, and AI—works on the same campaign through a stakeholder journey that enters the campaign lifecycle at different stages. Navigation, workspaces, approvals, documents, reporting, and collaboration must always reinforce the campaign lifecycle rather than independent applications or disconnected pages.

---

## 1. Product definition

Thinkway is a **workflow-driven enterprise operating system** for influencer marketing operations.

It is **not**:

- A collection of independent pages  
- A browser-tab metaphor applied to workspaces  
- A set of separate apps (Campaign / Studio / AI / Finance / Portals) sharing a logo  

It **is**:

- A single product organized around **business lifecycles**  
- A persistent business context that follows every participant  
- A navigation system that teaches **what comes next**  
- **One campaign, many stakeholder journeys** — Internal Ops, Commercial, Client, Vendor, Creator, Finance, Executive, and AI Assistant all work on the same campaign through responsibility-appropriate paths  

---

## 2. Current state diagnosis (platform-wide)

### 2.1 What is already strong (preserve)

| Foundation | Why it matters |
|------------|----------------|
| Campaign Module Baseline | List ↔ workspace continuity started; persistent shell; unique workspace identities |
| Enterprise Tabs | Single tab primitive (must evolve into process navigation, not be discarded) |
| Financial Display Standard | ISO money language platform-wide |
| Deliverables selection model | Operational integrity |
| Client IO / Vendor IO enterprise flows | Real lifecycle already exists in commercial domain |
| List → Workspace pattern | Clients, Vendors, Groups, Campaigns share the shape |

### 2.2 Structural inconsistencies (fix via architecture)

| Issue | Evidence |
|-------|----------|
| **Multiple product identities** | Platform V6 lists · Aurora Campaign · Studio/AI purple chrome · Discovery lavender · Finance process hubs |
| **Multiple navigation systems** | Collapsible sidebar · HomeWorkspaceNavTabs (4 pillars) · Discovery topnav · Enterprise Tabs · Hero actions · Studio internal tabs · Copilot dock |
| **Campaign Portfolio ≠ Campaign Workspace language** | Portfolio is V6 table; workspace is Aurora OS |
| **Studio / AI feel like other apps** | Live at `/studio` + `/ai/...`, not inside Campaign shell; weak return path |
| **Media Plan is a sibling route** | `/campaigns/[id]/media-plan` outside Enterprise Tabs / process rail |
| **“Intelligence” name collision** | Campaign AI (`/ai`) · warehouse (`/intelligence`) · Discovery intelligence library |
| **Portfolio lacks lifecycle cues** | Table shows money/PO; not Stage · Progress · Health · Next action |
| **Tabs ≠ process** | Workspace rail reads as peer tabs, not lifecycle progression |
| **Parallel destinations** | Hero Studio/Media Plans + sidebar Studio/Campaign AI + Overview card shortcuts |

### 2.3 Root cause

The product is still organized around **pages and modules**.  
Operators think in **lifecycles and next actions**.

---

## 3. Target architecture principles

1. **Process over pages** — Primary structure is the business lifecycle.  
2. **One navigation philosophy** — Platform → Module → Business Process → Content. Nothing else.  
3. **Persistent business context** — Identity, status, health, stage, KPIs stay visible while operational content changes.  
4. **Progression, not peer switching** — Moving Overview → Assignments → Client IO feels like advancing work, not opening another tab.  
5. **One design language** — Spacing, type, badges, tables, empty states, density converge (Campaign Baseline + Product UX Standards as seed).  
6. **Extend, don’t discard** — Evolve Enterprise Tabs into Business Process Navigation; keep Financial Display, Deliverables binding, approval/IO logic.  
7. **Recommended next action** — Every portfolio row and workspace header answers “what should I do next?”  
8. **Same shell for Studio & AI** — Collaborative/AI surfaces inherit campaign (or entity) context; they are workspaces, not products.  
9. **Stakeholder journeys on one spine** — Every participant enters the shared campaign lifecycle at the stage matching their role; portals and hubs extend journeys, they never become independent products.

---

## 4. Unified mental model

```
Platform (enterprise OS shell)
  └── Module (e.g. Campaigns)
        └── Portfolio (operational command center)
              └── Entity (Campaign)  ← shared identity for all stakeholders
                    └── Business Lifecycle (shared stage spine)
                          ├── Stakeholder Journey (role lens / entry stage)
                          └── Workspace / Stage surface
                                └── Operational details
```

### Architecture layers on the campaign

| Layer | Answers | SSOT |
|-------|---------|------|
| **Campaign Lifecycle Architecture** | What is the canonical stage spine? What must every feature map to? | [`12-…`](./12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md) |
| **Business Process Architecture** | How do stages progress operationally? | [`03-…`](./03-BUSINESS_PROCESS_ARCHITECTURE.md) |
| **Stakeholder Journey Architecture** | Who enters where? What can they do? | [`11-…`](./11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md) |
| **Master Navigation Architecture** | How does the UI teach stage state and next action? | [`02-…`](./02-MASTER_NAVIGATION_ARCHITECTURE.md) |

Participants always know:

| Signal | Meaning |
|--------|---------|
| Where I came from | Portfolio / portal home / previous stage |
| Where I am | Campaign identity + current stage + my journey |
| What is done | Completed stages (shared spine) |
| What is next | Upcoming / recommended action for my role |
| What needs attention | Blocked / waiting on me or others |
| What to do now | Primary CTA for this stakeholder |

---

## 5. Module alignment summary

| Module | Today | Target |
|--------|-------|--------|
| Campaign Portfolio | V6 list | Lifecycle dashboard (stage, health, next action) |
| Campaign Workspace | Aurora + peer tabs | Same module; **Business Process Navigation** |
| Media Plan | Sibling page | Lifecycle stage (Planning) inside Campaign ecosystem |
| Studio | Separate `/ai` app | Campaign collaborative workspace (same identity/nav language) |
| Thinkway Intelligence (AI) | Separate branded app | Context-aware assistant **within** current business object |
| Finance | Process hubs | Same nav philosophy; document lifecycle cues |
| Clients / Vendors | V6 entity workspaces | Same process nav + header hierarchy |
| Discovery | Own topnav language | Align chrome over time; keep discovery-specific tools |
| Client / Creator / Vendor portals | Separate portal shells | Stakeholder journeys on same campaign spine |
| Reporting Hub (future) | Risk of standalone BI | Executive / Ops journey extension |
| AI Assistant | Separate branded app risk | In-campaign participant mode |

---

## 6. Stakeholder journeys (summary)

| Stakeholder | Enters lifecycle at | Extends via |
|-------------|---------------------|-------------|
| Internal Operations | Full rail | Campaign Workspace |
| Commercial | Planning → Client IO | Campaign + Commercial |
| Client | Client IO / approvals / performance | Client Collaboration Portal |
| Vendor | Vendor IO / deliverables | Vendor Portal |
| Creator | Deliverables / publications / payments | Creator Portal |
| Finance | Finance / Collection | Finance module (campaign-bound) |
| Executive | Overview / Reporting | Portfolio + Reporting Hub |
| AI Assistant | Current user’s stage | In-context Assist / Copilot |

All journeys **begin and end on the same campaign identity**.

---

## 7. Non-goals

- Rewriting APIs, schema, RLS, server actions  
- Changing billing/approval/IO calculation rules  
- Wizard-forced linear UX that blocks legitimate skip-ahead  
- Discarding Enterprise Tabs engineering — **evolve** it  
- Reopening Campaign redesign for visual polish alone  
- Building portals as independent products outside Stakeholder Journey Architecture  

---

## 8. Final freeze approval (after doc 12)

Approve [`12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`](./12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md), then freeze:

1. Platform UX Architecture (this doc)  
2. Business Process Architecture  
3. Stakeholder Journey Architecture  
4. Campaign Lifecycle Architecture  

Then authorize **Phase 1 only**.

**Implementation remains paused until doc 12 is explicitly approved.**
