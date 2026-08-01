# 03 — Business Process Architecture

**Status:** Conditionally approved — stage SSOT defers to [`12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`](./12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md)  
**Depends on:** [`01-PLATFORM_UX_ARCHITECTURE.md`](./01-PLATFORM_UX_ARCHITECTURE.md) · [`12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`](./12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md)

---

## 1. Thesis

Organize the product around **business lifecycles**, not page inventories.

A lifecycle defines:

- Ordered stages  
- Entry / exit criteria (presentation cues only in this initiative)  
- Recommended next actions  
- Attention states (blocked, overdue, waiting on client/vendor)  
- Which workspace owns operational work for that stage  

---

## 2. Process vs wizard

| Wizard (avoid as default) | Process navigation (target) |
|---------------------------|-----------------------------|
| Forced linear steps | Ordered stages with skip-ahead when valid |
| “Next” only | Stage rail + recommended CTA |
| Hides later work | Shows completed / current / upcoming / blocked |
| Feels like onboarding | Feels like operations |

Operators may open Finance early; the UI still shows where that sits in the lifecycle.

---

## 3. Campaign as the reference process

```
Create → Plan → Discover → Shortlist → Media Plan → Commercial Approval
  → Assignments → Client IO → Vendor IO → Deliverables → Performance
  → Finance → Collection → Reporting → Completed
```

Each stage maps to a surface (existing routes/features where possible).  
Navigation should **narrate** this order.

---

## 4. Process signals (every portfolio + workspace)

| Signal | Portfolio row | Workspace header |
|--------|---------------|------------------|
| Current stage | Yes | Yes |
| Progress | Yes (simple) | Yes (lifecycle strip) |
| Health | Yes | Yes |
| Blocked / attention | Yes | Yes |
| Next recommended action | Yes | Primary CTA |
| Completed stages | Optional | Process rail |

---

## 5. Adjacent processes (same philosophy)

| Domain | Lifecycle sketch |
|--------|------------------|
| Client | Onboard → Commercial ready → Active campaigns → Billing relationship |
| Vendor | CRM complete → Assignable → IO → Delivery → Payment |
| Invoice | Draft → Approve → Post → Collect → Close |
| Media Plan | Draft → Review → Approve → Execute → Actual/Remaining |
| Quotation | Draft → Send → Approve → Convert → Campaign |

---

## 6. How stages connect

Each workspace should:

1. State why you are here (stage purpose)  
2. Show operational summary unique to the stage  
3. Offer the stage’s primary work  
4. Offer a clear **Continue** / recommended next stage when prerequisites are met  
5. Never rely on the user inventing the next URL  

---

## 7. Mapping to existing Campaign surfaces

| Stage cluster | Existing surface |
|---------------|------------------|
| Overview / health | Overview |
| Assignments | Assignments tab |
| Client IO | Client IO tab |
| Vendor IO | Vendor IO tab |
| Deliverables | Deliverables tab |
| Performance | Performance tab |
| Finance / collection cues | Finance tab |
| History | Timeline / Workflow |
| Media Plan / Studio | Today: sibling routes — target: Planning cluster in process rail |
| Discovery / shortlist | Today: Discovery module — target: deep-link with campaign context |

---

## 8. Approval questions

1. Accept Campaign lifecycle as the platform reference process?  
2. Accept non-linear access with process narration (not forced wizard)?  
3. Accept Planning/Studio as stages in the Campaign process, not separate products?
