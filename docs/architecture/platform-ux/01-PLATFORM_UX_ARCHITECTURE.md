# 01 — Thinkway Platform UX Architecture

**Status:** Draft for Product approval  
**Initiative:** Platform UX & Business Process Architecture  
**Constraints:** No API · DB · workflow engine · calculation · permission changes

---

## 1. Product definition

Thinkway is a **workflow-driven enterprise operating system** for influencer marketing operations.

It is **not**:

- A collection of independent pages  
- A browser-tab metaphor applied to workspaces  
- A set of separate apps (Campaign / Studio / AI / Finance) sharing a logo  

It **is**:

- A single product organized around **business lifecycles**  
- A persistent business context that follows the operator  
- A navigation system that teaches **what comes next**

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

---

## 4. Unified mental model

```
Platform (enterprise OS shell)
  └── Module (e.g. Campaigns)
        └── Portfolio (operational command center)
              └── Entity (Campaign)
                    └── Business Lifecycle (stage progression)
                          └── Workspace / Stage surface
                                └── Operational details
```

Operators always know:

| Signal | Meaning |
|--------|---------|
| Where I came from | Portfolio / previous stage |
| Where I am | Entity + current stage |
| What is done | Completed stages |
| What is next | Upcoming / recommended action |
| What needs attention | Blocked / overdue / health |
| What to do now | Primary CTA |

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

---

## 6. Non-goals

- Rewriting APIs, schema, RLS, server actions  
- Changing billing/approval/IO calculation rules  
- Wizard-forced linear UX that blocks legitimate skip-ahead  
- Discarding Enterprise Tabs engineering — **evolve** it  
- Reopening Campaign redesign for visual polish alone  

---

## 7. Approval question

Do we accept that Thinkway’s primary UX metaphor is **business process progression**, and that all modules (starting with Campaigns, then Studio/AI, then Finance/CRM) must converge on one navigation and shell philosophy?

**Implementation must not start until Product answers Yes.**
