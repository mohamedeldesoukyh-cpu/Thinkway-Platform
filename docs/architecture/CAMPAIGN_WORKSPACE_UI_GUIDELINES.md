# Campaign Workspace UI Guidelines (Aurora)

**Status:** Governing guidelines (paired with UI freeze)  
**Freeze:** [`CAMPAIGN_WORKSPACE_UI_FREEZE.md`](./CAMPAIGN_WORKSPACE_UI_FREEZE.md) — frozen 2026-08-01  
**Audience:** Engineers and agents adding features to `/campaigns/[id]` after the Release 2.3 Aurora freeze.

---

## Purpose

Aurora is the **design foundation** for the Campaign Workspace and the reference language for future Thinkway workspace surfaces.

These guidelines exist so new capabilities (Planning Board, Copilot, Reporting, Notifications, Analytics) **extend** the frozen UI instead of inventing a new look.

---

## Non-negotiables

1. **Do not redesign** Campaign Workspace chrome, tab shells, summary cards, or Overview command-center structure unless Product explicitly reopens UI scope.
2. **No new visual style** inside Campaign Workspace (no alternate card systems, banner themes, or one-off typography scales).
3. Prefer **functional** change: new data, actions, sheets, boards, and workflows that plug into existing Aurora patterns.
4. Keep tables **secondary** — never start a workspace with a large table above KPIs.
5. Presentation changes that accompany features must reuse existing CSS tokens in `app/styles/campaign-workspace.css`.
6. **Enterprise Tabs is the only approved workspace tab component** — see below.

---

## Information hierarchy (every focused workspace)

Use `CampaignWorkspaceFrame` (`features/campaigns/components/aurora/campaign-workspace-frame.tsx`):

1. Workspace title  
2. Status (`AuroraStatusPill`)  
3. KPIs / summary cards (`stats`)  
4. Primary actions (`tools` — top-right)  
5. Optional short banner (errors, sync health, flow chips)  
6. Collapsible `details` for low-priority meta / charts / lifecycle  
7. Operational content + registers  
8. Guided empty via `AuroraEmptyState` when there is no register content  

Overview is the exception: use the command-center ops-card pattern (`campaign-command-center.tsx`), not a duplicate of tab frames.

---

## Primary actions

| Rule | Detail |
|------|--------|
| Placement | Always in `CampaignWorkspaceFrame` `tools` (header top-right) |
| Examples | Create, Generate, Send, Approve, Export, Edit, Open register |
| Avoid | Moving the same primary CTA to random nested toolbars between tabs |
| Nested toolbars | Filters, column settings, audience toggles only — use `actionsOnly` on `CampaignOperationalSectionHeader` when the workspace title already exists |

---

## Summary cards

- Use the shared Aurora stat row / `thinkway-aurora-scard` language via frame `stats`.
- Consistent height, padding, uppercase labels, tabular values, tone classes (`blue` / `pos` / `amber` / `mut`).
- Do not add a second KPI strip that repeats the same metrics.

---

## Empty states

Prefer `AuroraEmptyState`:

- Contextual title (“No Client IO has been generated yet.”)
- One short guidance sentence
- Recommended next action when an action exists

Do not ship bare “No data” copy in Campaign Workspace.

---

## Registers & tables

- Quiet register label; bordered register body.
- Sticky headers, denser row padding, restrained hover.
- Status badges at row level may remain domain-specific; workspace-level status uses Aurora pills.
- Multi-register workspaces (Finance) may keep section titles; single-register tabs should avoid duplicate titles (`actionsOnly`).

---

## Progressive disclosure

Collapse anything that is not required to understand the campaign in the first viewport:

- Document / delivery meta (Client IO)
- Trends / charts (Performance)
- Billing lifecycle legend (Finance)
- Campaign details & PO governance (Overview)

Default: **collapsed**.

---

## Extending with new modules

| Module | Integration rule |
|--------|------------------|
| Planning Board | New surface/tab or sheet that uses Aurora frame + ops language; disabled placeholder already exists — replace functionally, keep chrome |
| Copilot | Dock / panel must use campaign tokens; do not introduce a separate “AI theme” |
| Reporting Hub | Summary-first; exports in `tools`; charts in collapsible details or dedicated report view |
| Notifications | Prefer subtle pills / inbox patterns aligned with Aurora; no full-width alarm banners |
| Enterprise Analytics | KPI → insight → drill-down; reuse scard / ops-card patterns |

When adding a tab: preserve existing tab IDs where possible; do not reshuffle frozen navigation without Product approval.

---

## Platform navigation standard — Enterprise Tabs

**Enterprise Tabs is the platform navigation standard** for all workspace tab rails.

| Item | Location |
|------|----------|
| Component | `components/workspace/enterprise-tabs.tsx` |
| Styles | `app/styles/enterprise-tabs.css` |
| Variants | `underline` (Campaign Aurora) · `pill` (Groups/Finance/Billing ops) · `plain` (Client/Vendor entity profiles) |

**Rules**

1. Future modules **must reuse** Enterprise Tabs (`EnterpriseSortableTabsBar`, `EnterpriseTabsList` + `EnterpriseTabTrigger`, or `EnterpriseTabsRow` + `EnterpriseTabButton`).
2. **No page-specific tab implementations** — do not invent local tab buttons, badge-in-label hacks, or per-route tab CSS.
3. **No page-specific overrides** of Enterprise Tab sizing, overflow, truncation, badge layout, or active indicator.
4. Content sizing, min/max width, ellipsis labels, badge separation, equal gaps, and scroll-by-default (wrap only when `overflow="wrap"`) are owned by the shared component.
5. Campaign / operational wrappers may only pass `variant`, `overflow`, reorder handlers, and skin-adjacent padding classes — not alternate layout systems.

Secondary in-sheet tabs (detail drawers, dialogs) may continue to use shadcn `Tabs` for local panels; **workspace-level navigation rails must use Enterprise Tabs**.

---

## Tokens & styling

- Source of truth: `app/styles/campaign-workspace.css` (`--camp-*` tokens).
- Workspace tabs: Enterprise Tabs only (see above).
- Brand primary remains Thinkway green `#1D9E75` at product level; campaign Aurora blues/ambers are status accents within workspace chrome.
- Respect `prefers-reduced-motion`.
- Keep focus-visible rings on tools, discloses, and register interactive controls.

---

## Defect vs redesign

| Allowed without reopening freeze | Requires Product approval |
|----------------------------------|---------------------------|
| Broken layout / overflow / contrast failure | New visual system or theme |
| Missing focus ring / keyboard trap | Reordering workspace hierarchy |
| Copy fix in empty state | Replacing Aurora cards with a different card kit |
| Wiring a new action into existing `tools` | Full-tab visual redesign |

---

## Governance habit

After any future **major UX initiative**, ship:

1. A freeze record (objectives, scope, accepted differences, date, acceptance criteria, extension rules)
2. A guidelines doc for how to extend the frozen surface

Store both under `docs/architecture/`.
