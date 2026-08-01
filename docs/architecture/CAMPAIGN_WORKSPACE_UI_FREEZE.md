# Campaign Workspace UI Design Freeze

**Status:** Frozen — protected Campaign Module Baseline · IA initiative **CLOSED**  
**Freeze date:** 2026-08-01 (Aurora) · IA complete / closed 2026-08-01  
**Milestone:** Campaign Workspace UI Design Freeze + Campaign Information Architecture Complete  
**Protected baseline:** [`CAMPAIGN_MODULE_BASELINE.md`](./CAMPAIGN_MODULE_BASELINE.md)  
**Branch tip:** `31c5a030` on `develop`  
**Canonical IA:** [`CAMPAIGN_INFORMATION_ARCHITECTURE.md`](./CAMPAIGN_INFORMATION_ARCHITECTURE.md)  
**Product standards:** [`PRODUCT_UX_STANDARDS.md`](./PRODUCT_UX_STANDARDS.md)  
**Scope class:** Presentation / UX only — no API, database, workflow, server action, or business-logic freeze implications.

---

## Design objectives achieved

1. **One Campaign module** — List and Workspace share continuity, navigation philosophy, and Aurora language.
2. **Persistent workspace shell** — identity, KPIs, actions, and Enterprise Tabs stay mounted; only content swaps.
3. **Summary-first hierarchy** — title → status → workspace-specific KPIs → primary actions → operational content.
4. **Reduced cognitive load** — no inactive primary actions; no hero tab-rail duplicates; no campaign finance KPI spam outside header/Finance.
5. **Enterprise Tabs** — sole in-workspace navigation.
6. **Financial Display Standard** — ISO currency codes via shared formatter.
7. **Deliverables binding** — selection SSOT, upload lock, Save/Discard/Cancel retained.
8. **Accessible polish** — focus rings, keyboard-reachable discloses, sticky tab rail, `prefers-reduced-motion` respected.

---

## Scope (frozen surface)

| In scope (frozen) | Out of scope (not frozen by this doc) |
|-------------------|----------------------------------------|
| Campaign List command-center presentation at `/campaigns` | Planning Board functional build (R2.2a) |
| Campaign Workspace chrome at `/campaigns/[id]` | Copilot functional build (R2.2b) |
| Overview command center + focused workspace identities | Reporting Hub, Notifications, Enterprise Analytics |
| Shared Aurora frame, summary cards, empty states, register density | API / DB / RLS / server actions / workflows |
| Enterprise Tabs underline rail + pin behavior | Other platform modules — adopt this IA when redesigned |
| Tab IDs / URLs as shipped | Business rules, billing eligibility, IO generation logic |

**Canonical implementation anchors**

- IA: `docs/architecture/CAMPAIGN_INFORMATION_ARCHITECTURE.md`
- Frame: `features/campaigns/components/aurora/campaign-workspace-frame.tsx`
- Overview: `features/campaigns/components/aurora/campaign-command-center.tsx`
- Styles: `app/styles/campaign-workspace.css`
- Guidelines: [`CAMPAIGN_WORKSPACE_UI_GUIDELINES.md`](./CAMPAIGN_WORKSPACE_UI_GUIDELINES.md)

---

## Remaining accepted UX differences

These are intentional product decisions, not defects:

| Difference | Rationale |
|------------|-----------|
| Overview uses ops cards + readiness instead of `CampaignWorkspaceFrame` | Overview is the operating index |
| Chrome scrolls away; Enterprise Tabs pin | Content-first scroll; shell identity remains mounted across tab switches |
| Finance may show Outstanding and Receivable from the same `billing_outstanding` SSOT | Distinct AR aging not yet modeled; labels preserved for enterprise language |
| Timeline Notifications shows `—` until a notifications feed exists | No fabricated counts |
| Finance keeps multiple register section titles | Multi-register workspace needs local labels |
| Deliverables unit inspector retains some legacy muted text | Interior detail pane; not workspace chrome |
| Some table-cell status chips predate Aurora pills | Row-level; frame-level status is standardized |

---

## Acceptance criteria (freeze gate)

- [x] List → Workspace feels like one module  
- [x] Persistent shell on tab switch (no header rebuild)  
- [x] Planning Board / Copilot hidden  
- [x] Workspace identities unique  
- [x] Enterprise Tabs sole workspace nav  
- [x] Financial Display Standard applied  
- [x] Deliverables selection model intact  
- [x] Docs updated to IA Complete baseline  

**Future features must extend this baseline — not redesign it.**
