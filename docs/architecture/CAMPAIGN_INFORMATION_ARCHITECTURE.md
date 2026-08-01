# Campaign Information Architecture (Canonical)

**Status:** Complete — baseline for all future operational modules  
**Milestone:** Campaign Information Architecture Complete (2026-08-01)  
**Branch:** `develop`  
**Scope:** Presentation / information architecture only  
**Non-goals:** No API, database, workflow, calculation, or server-action changes

Related:

- Financial Display Standard — [`FINANCIAL_DISPLAY_STANDARD.md`](./FINANCIAL_DISPLAY_STANDARD.md)
- Deliverables documentation selection model (frozen keep)
- Enterprise Tabs — `components/workspace/enterprise-tabs.tsx`
- UI freeze / guidelines — [`CAMPAIGN_WORKSPACE_UI_FREEZE.md`](./CAMPAIGN_WORKSPACE_UI_FREEZE.md) · [`CAMPAIGN_WORKSPACE_UI_GUIDELINES.md`](./CAMPAIGN_WORKSPACE_UI_GUIDELINES.md)

---

## Product objective

Campaign List and Campaign Workspace are **one continuous Campaign module**. Opening a campaign continues the same product identity — it does not launch a separate application.

This IA is the reference pattern for Planning Board, Copilot, Reporting Hub, Notifications, and Enterprise Analytics.

---

## Hierarchy

```
Platform Navigation (Overview · Finance · Campaigns · Clients)
  ↓
Campaign Module (/campaigns) — portfolio command center
  ↓
Campaign Workspace (/campaigns/[id]) — persistent shell
  ↓
Operational content (Enterprise Tabs swap body only)
```

## Persistent workspace shell

Mounted once per campaign; **only the content body changes** on tab navigation:

1. Module continuity crumb (`Campaigns / TW-…`) + prev/next  
2. Campaign identity + status  
3. Campaign KPI band (Revenue · Cost · Gross Profit · Margin) — once  
4. Highest-frequency actions  
5. Enterprise Tabs rail (pins on scroll)  
6. Workspace content body  

Overview operating cards are an **index into workspaces**, not a second tab rail.

## Hero actions (live only)

| Visible | Role |
|---------|------|
| Studio | Primary |
| Media Plans | External Media Plan surface |
| Client IO chrome | Set up / document controls |
| ⋯ overflow | Report · Duplicate · Edit header · Details · Cancel |

**Hidden until implemented:** Planning Board (R2.2a), Copilot (R2.2b). Never show disabled primary stubs.

## Workspace summary identities

| Workspace | Summary metrics |
|-----------|-----------------|
| Overview Health | Readiness · Blockers · Gaps (not finance) |
| Assignments | Assignments · Creators · Deliverables · Progress · Completion · Blocked · Ready |
| Client IO | Documents · Generated · Sent · Approved · Pending · (+ Agreed amount) |
| Vendor IO | Orders · Email Sent · Manual Delivery · Approved · Outstanding |
| Deliverables | Units · Pending · Received · Approved · Missing |
| Performance | Publications · Reach · Engagement · Completion |
| Finance | Revenue · Cost · Gross Profit · Margin · Collected · Outstanding · Receivable · Remaining PO |
| Timeline | Activities · Approvals · Finance Events · Notifications |
| Workflow | Blockers · Approvals · Pending |

Campaign-level finance KPIs appear in the header. Finance may repeat R/C/GP/Margin because it is the financial command center.

## Campaign List

- Module command KPIs (ISO KPI precision)  
- Portfolio register with clear open-workspace affordance  
- Platform **Campaigns** nav stays active inside the workspace  

## Canonical components

| Concern | Single implementation |
|---------|----------------------|
| Workspace tabs | Enterprise Tabs |
| Money display | `lib/finance/currency-format.ts` |
| Campaign KPIs | `campaign-kpi-cards.tsx` |
| Workspace frame / summaries | `campaign-workspace-frame.tsx` |
| Status pills | Aurora status pills / campaign status badge |

Legacy unused KPI strip wrappers were removed during the Enterprise UX Validation Pass.

## Extension rules

1. New workspaces must declare a unique summary identity.  
2. Do not reintroduce disabled primary actions.  
3. Do not duplicate Enterprise Tabs destinations in the hero.  
4. Planning Board / Copilot must plug into this shell without a second nav system.  
5. Financial Display Standard is mandatory for all money surfaces.
