# Publication Workspace QA

Generated: 2026-06-23

## Phase 1 — Drawer stability

| Check | Expected | Status |
| --- | --- | --- |
| Click `(...)` menu | Menu opens; drawer does **not** flash | Manual |
| Select **View details** | Drawer opens and **stays open** | Manual |
| Click inside drawer | Drawer remains open | Manual |
| Parent publications poll refresh | Drawer stays open; row data updates | Manual |
| Close via X button | Drawer closes explicitly | Manual |
| Automated regression | `npm run test:publication-workspace-open` | CI |

### Root cause (fixed)

Radix `DropdownMenu` dismiss fired `pointerDownOutside` on the newly opened `Sheet`, closing it immediately. Fix:

- `schedulePublicationWorkspaceOpen()` — defer open to next animation frame
- `onSelect={(e) => e.preventDefault()}` on menu items
- `shouldPreventSheetOutsideDismiss()` on sheet content
- Stable row snapshot via `detailSnapshotRef` during bundle refetch

## Phase 2 — Enterprise workspace

| Check | Expected |
| --- | --- |
| Drawer width | 80vw, max 1280px, min 1100px |
| Sticky header | Creator, badges, actions visible while scrolling |
| Overview layout | 60% media / metadata, 40% KPI grid |
| All 9 tabs | Render content or rich empty state (never blank rows) |
| Manual metrics tab | Editable fields + Save / Restore automatic |
| Metrics history | Loads from `publication_metric_sync_logs` |

## Phase 3 — Bulk metrics import

Existing **Import metrics** (CSV/Excel) on Performance Center toolbar:

- Columns: Publication URL, Views, Reach, Impressions, Likes, Comments, Shares, Saves
- Per-publication manual override via **Manual metrics** tab

## Manual verification steps

1. Open campaign → Performance tab
2. Click `(...)` on any row → **View details** — confirm no flash
3. Verify sticky header, KPI cards, screenshot hero
4. Open **Manual metrics** → enter values → **Save manual metrics**
5. Open **Metrics history** → confirm sync log entries
6. **Regenerate screenshot** from overflow menu
7. Resize browser — workspace remains usable above 1100px
8. Keyboard: Tab through header actions; Esc closes drawer

## Known limitations

- AI Insights scores require future AI pipeline integration
- Audience demographics depend on provider API coverage
- Comment sentiment/keywords placeholder until NLP module ships
- Excel import requires `.xlsx` with header row (existing toolbar action)

## Commands

```bash
npm run test:publication-workspace-open
npm run test:deferred-bundle-policy
npm run test:metrics-sync-poll-policy
```
