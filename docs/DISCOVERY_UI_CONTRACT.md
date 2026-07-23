# Discovery UI Contract

**Status:** Frozen platform API (Phase 2 complete)  
**Golden reference:** Discovery Search (`/discovery/search`)  
**Import barrel:** `@/features/discovery/components/design-system`

Any new Discovery feature **must consume** these components. Do not create page-specific alternatives.

---

## Mandatory components

| Contract name | Module | Use for |
|---------------|--------|---------|
| `DiscoveryCreatorExactRow` | `discovery-creator-exact-row.tsx` | Every creator list row |
| `DiscoveryCreatorExactHeader` | `discovery-creator-exact-row.tsx` | Creator list column headers |
| `buildDiscoveryCreatorViewModel` | `view-models/discovery-creator-view-model.ts` | All creator row / profile display data |
| `DiscoveryPageShell` | `discovery-page-shell.tsx` | Page layout, nav, flush/list/workspace variants |
| `DiscoveryFilterBar` | `design-system/discovery-filter-bar.tsx` | List page filter chrome |
| `DiscoveryFilterDrawer` | `design-system/discovery-filter-drawer.tsx` | Filter drawer shell |
| `DiscoverySelectionFlyout` | `design-system/discovery-selection-flyout.tsx` | Bulk selection actions |
| `DiscoveryEmptyState` | `design-system/discovery-empty-state.tsx` | Zero-data states |
| `DiscoveryFilteredEmptyState` | `design-system/discovery-filtered-empty-state.tsx` | Filtered zero results |
| `DiscoveryLoadingState` | `design-system/discovery-loading-state.tsx` | Page/section loading |
| `DiscoveryListSkeleton` / `DiscoverySearchExactListSkeleton` | `design-system/` | List loading skeletons |
| `DiscoveryWorkspaceToolbar` | `design-system/discovery-workspace-chrome.tsx` | Detail workspace back + actions bar |
| `DiscoveryListCard` + `DISCOVERY_TABLE_*` | `discovery-list-primitives.tsx` | Non-creator list tables (shortlists, quotations) |
| `DiscoverySectionHeader` | `design-system/discovery-section-header.tsx` | Section titles inside workspaces |
| `DiscoveryToolbar` helpers | `design-system/discovery-toolbar.tsx` | Toolbar icon/button patterns |
| `DiscoveryFilterSheet` / dialog chrome | `design-system/` | Sheets and dialogs |
| `InterestChips` | `discovery-interest-chips.tsx` | Category / interest chips |

Search aliases (`CreatorSearchExactRow`, `CreatorSearchExactHeader`) re-export the canonical row — prefer `DiscoveryCreator*` in new code.

---

## Data flow (required)

```
UnifiedCreatorResult
  → buildDiscoveryCreatorViewModel(creator, options)
  → DiscoveryCreatorExactRow (or profile/drawer consuming same VM fields)
```

Never duplicate metric, avatar, category, or platform resolution in a page component.

---

## Extension rules

1. **Extend, don't bypass** — add props or slots to canonical components (`meta`, `actions`, `rowBehavior`).
2. **Domain grids are exceptions** — quotation deliverable lines, compare matrix cells, and import tables may keep domain layout if they are not creator browse rows.
3. **No local design tokens** — use `discovery-design-tokens.ts` and `DISCOVERY_TABLE_*` classes.
4. **No duplicate flyouts** — wrap `DiscoverySelectionFlyout`, not `GlassSelectionFlyout` directly.
5. **Loading / empty** — use design-system components; button spinners (`Loader2` on submit) are fine.

---

## Deprecated — do not use

| Item | Replacement |
|------|-------------|
| `CreatorResultRow` | `DiscoveryCreatorExactRow` |
| `CreatorResultGridHeader` | `DiscoveryCreatorExactHeader` + toolbar sort |
| `creator-result-row.tsx` | Removed |
| Local `TH_CLASS` / `TD_CLASS` creator tables | Exact-row layout |
| Page-specific creator metric stacks in lists | ViewModel + exact row |
| Direct `GlassSelectionFlyout` in Discovery features | `DiscoverySelectionFlyout` |

---

## Phase 3 order (next modules)

1. **Creator Profile** — consume `buildDiscoveryCreatorViewModel`; match Search typography/spacing tokens.
2. **Creator Drawer** — unified sheet chrome; reuse avatar, metrics, badges, hover logic from exact row.
3. **Campaign Match** — build on shared Discovery components; no campaign-specific creator cards.
4. **AI Discovery** — same row + detail components; AI changes *what* is shown, not *how* creators render.

After Phase 3, see **`docs/DISCOVERY_ARCHITECTURE.md`** for full data-flow and extension guidelines.

---

## Regression protection

Run before merge:

```bash
npm run test:discovery-ui-contract
```

CI runs this via `npm run validate:discovery-ui-contract` on push/PR.

Violations fail the build — fix by adopting the contract, not by suppressing checks.
