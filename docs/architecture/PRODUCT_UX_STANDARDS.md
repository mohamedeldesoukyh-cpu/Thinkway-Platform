# Thinkway Product UX Standards

**Status:** Governing platform standards  
**Effective:** 2026-08-01  
**Canonical reference implementation:** Campaign module  
**Baseline record:** [`CAMPAIGN_MODULE_BASELINE.md`](./CAMPAIGN_MODULE_BASELINE.md)

---

## Purpose

The Campaign module is the **canonical implementation** for Thinkway operational UX. Future modules inherit these patterns rather than inventing new ones.

Use this document before designing Groups, Clients, Vendors, Finance, Planning Board, Copilot, Reporting, Notifications, or Analytics surfaces.

---

## Canonical patterns (inherit from Campaign)

| Standard | Campaign reference | Rule |
|----------|-------------------|------|
| **Workspace architecture** | List → Workspace as one module; persistent shell | Module list opens detail inside the same product identity |
| **Navigation hierarchy** | Platform nav → Module → Workspace → Content | Do not add extra nav layers without a clear operational need |
| **Information hierarchy** | Identity → Health → KPIs → Actions → Workspace → Details | No section may interrupt this order |
| **KPI presentation** | Header KPI band (`campaign-kpi-cards`); metric icons; ISO KPI precision | Campaign finance KPIs once at campaign level; no currency-symbol icons |
| **Workspace summaries** | Unique identity per tab via `CampaignWorkspaceFrame` stats | Each workspace communicates something unique |
| **Enterprise Tabs** | `components/workspace/enterprise-tabs.tsx` | Only approved workspace tab rail |
| **Financial presentation** | [`FINANCIAL_DISPLAY_STANDARD.md`](./FINANCIAL_DISPLAY_STANDARD.md) | ISO codes; shared formatter; KPI vs detail precision |
| **Status badges** | Aurora pills / shared campaign status badge | Consistent tones; no one-off status kits in new modules |
| **Action placement** | Highest-frequency in chrome/tools; overflow for rare | No duplicate tab destinations in action rows |
| **Progressive disclosure** | Collapsed details for meta/charts/lifecycle | Default collapsed; keep above-the-fold operational |

---

## Navigation hierarchy (platform)

```
Platform Navigation
  ↓
Module Navigation / Module command center
  ↓
Entity Workspace (persistent shell)
  ↓
Operational content (Enterprise Tabs swap body only)
```

---

## Information hierarchy (every entity workspace)

1. Which entity am I viewing?  
2. What is its current health / status?  
3. What are the most important KPIs?  
4. What actions are available?  
5. Which workspace am I in?  
6. What operational details belong here?

---

## Component SSOT

| Concern | Implementation |
|---------|----------------|
| Workspace tabs | Enterprise Tabs |
| Money formatting | `lib/finance/currency-format.ts` |
| Campaign KPI cards | `features/campaigns/components/aurora/campaign-kpi-cards.tsx` |
| Workspace frame / summaries | `features/campaigns/components/aurora/campaign-workspace-frame.tsx` |
| Aurora tokens | `app/styles/campaign-workspace.css` (`--camp-*`) |

Do not introduce parallel tab rails, money formatters, or KPI strip systems for new modules.

---

## Extension vs redesign

| Allowed | Requires Product approval |
|---------|---------------------------|
| Functional features in existing shell | New visual system / theme |
| New tab/surface using Aurora frame + Enterprise Tabs | Reordering frozen Campaign hierarchy |
| Wiring actions into existing `tools` regions | Full workspace redesign |
| Critical usability defect fix | Replacing Enterprise Tabs / Financial Display Standard |

---

## Related docs

- [`CAMPAIGN_MODULE_BASELINE.md`](./CAMPAIGN_MODULE_BASELINE.md)  
- [`CAMPAIGN_INFORMATION_ARCHITECTURE.md`](./CAMPAIGN_INFORMATION_ARCHITECTURE.md)  
- [`CAMPAIGN_WORKSPACE_UI_GUIDELINES.md`](./CAMPAIGN_WORKSPACE_UI_GUIDELINES.md)  
- [`FINANCIAL_DISPLAY_STANDARD.md`](./FINANCIAL_DISPLAY_STANDARD.md)  
- [`CAMPAIGN_MODULE_TECHNICAL_DEBT.md`](./CAMPAIGN_MODULE_TECHNICAL_DEBT.md)
