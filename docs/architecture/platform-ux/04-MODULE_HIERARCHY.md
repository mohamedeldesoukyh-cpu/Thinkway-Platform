# 04 — Module Hierarchy

**Status:** FROZEN — Thinkway Enterprise Platform Architecture v1.0
**Baseline:** [Thinkway Enterprise Platform Architecture v1.0](../THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md)

---

## 1. Target module map

```
Thinkway Platform
├── Home / Overview
├── Campaigns                          ← reference module for UX
│     ├── Portfolio
│     ├── Campaign Workspace (process)
│     ├── Planning cluster (Media Plan · Studio)
│     └── AI assistant (in-context)
├── Commercial
│     ├── Client IO register
│     ├── Vendor IO register
│     ├── Quotations
│     └── Shortlists
├── Finance
│     ├── Invoices / Adjustments
│     ├── Collections / Aging
│     ├── Posting / Periods / VAT / FX / Treasury
│     └── PO Tracker
├── Network
│     ├── Holding Groups
│     ├── Legal Entities (Clients)
│     ├── Brands
│     └── Vendors
├── Discovery
│     ├── Search / Match / Shortlists / Import
│     └── (align chrome over time)
├── Insights
│     └── Reports (+ clarify Intelligence warehouse)
└── Administration
      ├── Users / Roles / Permissions
      └── Ops Center / System health
```

---

## 2. Ownership rules

| Rule | Detail |
|------|--------|
| One home per business object | Campaign lives under Campaigns; invoice under Finance |
| Cross-links preserve origin | “Opened from TW-…” when jumping modules |
| No duplicate module brands | Studio is not a peer of Campaigns in Platform Nav |
| Registers vs workspaces | Registers list documents; workspaces operate an entity/process |

---

## 3. Current → target ownership shifts

| Surface today | Target ownership |
|---------------|------------------|
| Sidebar “Studio” + “Campaign AI” | Campaigns ecosystem (Planning / Assist) |
| `/campaigns/[id]/media-plan` | Campaigns → Planning stage |
| `/ai/...` Studio runtime | Campaigns collaborative workspace |
| HomeWorkspaceNavTabs omitting Vendors | Network includes Vendors; Home shortcuts optional |
| `/intelligence` warehouse | Insights (rename/clarify) — not “Campaign AI” |

---

## 4. Approval questions

1. Confirm Campaigns as the reference module for UX inheritance.  
2. Confirm Studio/AI leave Platform Nav as peer products.  
3. Confirm Commercial vs Finance boundary (IOs commercial; invoices/collections finance).
