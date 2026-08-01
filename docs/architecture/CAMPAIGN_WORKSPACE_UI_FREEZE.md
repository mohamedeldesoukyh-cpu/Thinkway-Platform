# Campaign Workspace UI Design Freeze

**Status:** Frozen  
**Freeze date:** 2026-08-01  
**Milestone:** Campaign Workspace UI Design Freeze (Release 2.3 Aurora)  
**Branch baseline:** `develop`  
**Scope class:** Presentation / UX only — no API, database, workflow, server action, or business-logic freeze implications.

---

## Design objectives achieved

1. **Premium enterprise day-long workspace** — Campaign Workspace feels cohesive for operators who live in it all day.
2. **Aurora design language applied consistently** across Overview and focused workspaces (Assignments, Client IO, Vendor IO, Deliverables, Performance, Finance, Timeline, Workflow).
3. **Summary-first information hierarchy** — title → status → KPIs → primary actions → operational content → detailed registers. Tables are secondary.
4. **Reduced cognitive load** — duplicate titles, redundant status KPIs, shouty nested headers, and always-visible secondary panels were removed or collapsed.
5. **Consistent primary action placement** — Generate / Send / Create / Export / Edit live in the shared workspace tools region (top-right).
6. **Guided empty states** — empty workspaces explain context and recommend the next action.
7. **Accessible polish** — focus rings, keyboard-reachable discloses, denser sticky table headers, `prefers-reduced-motion` respected.
8. **Environment chrome** — full-width orange env banner replaced by a subtle Aurora environment pill.

---

## Scope (frozen surface)

| In scope (frozen) | Out of scope (not frozen by this doc) |
|-------------------|----------------------------------------|
| Campaign Workspace chrome at `/campaigns/[id]` | Planning Board functional build (R2.2a) |
| Overview command center presentation | Copilot functional build (R2.2b) |
| Tab workspaces listed above (visual structure) | Reporting Hub, Notifications, Enterprise Analytics |
| Shared Aurora frame, summary cards, empty states, register density | API / DB / RLS / server actions / workflows |
| Env pill presentation in campaign shell | Other platform workspaces (Groups, Clients, Vendors) — adopt Aurora when those modules are redesigned |
| Tab IDs / URLs as shipped (no Campaign Lines tab this release) | Business rules, billing eligibility, IO generation logic |

**Canonical implementation anchors**

- Frame: `features/campaigns/components/aurora/campaign-workspace-frame.tsx`
- Overview: `features/campaigns/components/aurora/campaign-command-center.tsx`
- Styles: `app/styles/campaign-workspace.css`
- Guidelines: [`CAMPAIGN_WORKSPACE_UI_GUIDELINES.md`](./CAMPAIGN_WORKSPACE_UI_GUIDELINES.md)

---

## Remaining accepted UX differences

These are intentional product decisions, not defects. They do **not** justify further redesign:

| Difference | Rationale |
|------------|-----------|
| Overview uses ops cards + readiness checklist instead of the tab `CampaignWorkspaceFrame` | Overview is a command center; tabs are focused workspaces |
| Finance keeps multiple register section titles (queue / operational / invoices / payments) | Multi-register workspace needs local labels |
| Performance tools row can be dense (exports + add) | Correct placement; export surface is inherently multi-action |
| Assignments empty uses rich `AssignmentsEmptyState` | Stronger CTAs than generic empty chrome |
| Deliverables unit inspector retains some legacy muted text | Interior detail pane; not workspace chrome |
| Some table-cell status chips predate Aurora pills | Row-level; frame-level status is standardized |
| Timeline feed empties use compact guided copy | Keeps activity feeds above the fold |

---

## Acceptance criteria (freeze gate)

- [x] Shared Aurora workspace chrome on all focused campaign tabs
- [x] Hierarchy: title → status → KPIs → actions → content → registers
- [x] Primary actions consistently top-right in workspace tools
- [x] Guided empty states for major empty workspaces
- [x] Secondary / verbose panels collapsible where they hurt scroll
- [x] No API, database, workflow, or business-logic changes in the freeze commit
- [x] TypeScript clean on freeze baseline
- [x] Product acceptance of remaining minor UX differences
- [x] Freeze recorded in architecture + continuity docs

---

## Future extension rules

1. **No visual redesign** of the Campaign Workspace unless there is a **critical usability issue** or an **approved future release** that explicitly reopens UI scope.
2. **Functional enhancements only** after this freeze, including:
   - Planning Board (Release 2.2a)
   - Copilot (Release 2.2b)
   - Reporting Hub
   - Notifications
   - Enterprise Analytics
3. **New functionality must adopt Aurora** — integrate into existing Overview / tabs / sheets using `CampaignWorkspaceFrame`, summary cards, status pills, and register patterns. Do **not** introduce a parallel visual style.
4. **Presentation-only fixes** (contrast, focus, broken layout, critical a11y) may land without reopening redesign scope; document them as defect fixes, not redesigns.
5. After any major UX initiative elsewhere on the platform, create a freeze + guidelines pair under `docs/architecture/` (same pattern as this milestone).

---

## Related docs

- [`CAMPAIGN_WORKSPACE_UI_GUIDELINES.md`](./CAMPAIGN_WORKSPACE_UI_GUIDELINES.md) — how to extend without redesigning
- [`../ARCHITECTURE_ALIGNMENT.md`](../ARCHITECTURE_ALIGNMENT.md) — codebase vs product reference
- Continuity: `.cursor/continuity/PROMPT_SUMMARY.md`, `.cursor/continuity/SUMMARY.md`
