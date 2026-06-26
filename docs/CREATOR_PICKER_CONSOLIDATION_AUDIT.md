# Creator Picker Consolidation Audit

**Date:** June 2026  
**Branch:** `refactor/phase2-shared-domains-ui`  
**Scope:** Discovery Search, Shortlists, Quotations, Campaign Browser, Campaign assignment typeahead

---

## Executive Summary

Creator selection UI was duplicated across six surfaces with repeated `Set<string>` state, toggle/select-all logic, debounced browse fetches, checkbox indeterminate handling, and row rendering. A shared module at `features/creators/picker/` now centralizes selection primitives; domain wrappers preserve existing APIs and business rules.

---

## 1. Surfaces Audited

| Surface | File(s) | Container | Select mode | Browse API | Duplicated concerns |
|---------|---------|-----------|-------------|------------|---------------------|
| Discovery Search | `creator-search-workspace.tsx`, `creator-search-result-list.tsx` | Full page | Multi + bulk bar | `browseUnifiedCreatorsAction` | toggle, select-all, indeterminate, infinite scroll |
| Shortlist add | `add-creators-drawer.tsx` | Sheet | Multi | `browseUnifiedCreatorsAction` | search debounce, platform filter, dedup keys, row UI |
| Quotation import | `add-creators-to-quotation-modal.tsx` | Dialog tabs | Multi (3 lists) | Import actions (not browse) | `toggleSet`, select-all, checkbox lists ×3 |
| Campaign browser | `creator-browser-dialog.tsx` | Dialog | Multi + single assign | `browseUnifiedCreatorsAction` | selection Set, card toggle, pagination |
| Campaign discovery panel | `campaign-creator-discovery-panel.tsx` | Embeds browser | — | — | Delegates to browser |
| Influencer typeahead | `influencer-typeahead.tsx` | Embeds browser | Single | — | Delegates to browser |

### APIs (unchanged)

- `browseUnifiedCreatorsAction` — unified creator search (Discovery, Shortlist, Browser)
- `addUnifiedCreatorsToShortlist` — shortlist add policy + server action
- `addItemsToQuotation`, `importShortlistItemsToQuotation`, `importCampaignAssignmentsToQuotation` — quotation import
- `addCreatorToCampaignShortlistAction`, `unifiedToInfluencerSearch` — campaign assign path

### Permissions / server actions

No changes to RLS, action signatures, or eligibility rules (`isAddableCreator`, `isAssignableCreator`).

---

## 2. Shared Infrastructure Created

```
features/creators/picker/
├── creator-selection-types.ts      # Config, browse/selection types
├── creator-selection-utils.ts      # Pure selection + dedup helpers (testable)
├── creator-selection-hooks.ts      # useCreatorSelection, useCreatorBrowse, useDebouncedValue
├── creator-selection-hooks.test.ts # Regression tests for utils
├── creator-selection-provider.tsx  # Optional context wrapper
├── creator-selection-toolbar.tsx   # Select all / deselect / count / clear
├── creator-selection-table.tsx     # Compact rows + static import list
├── creator-search-panel.tsx        # Search + platform filter
├── creator-picker-dialog.tsx       # Dialog/Sheet shell (browse + multi/single)
├── shortlist-creator-picker.tsx    # Shortlist domain wrapper
├── quotation-creator-picker.tsx    # Quotation import list wrapper
├── campaign-creator-picker.tsx     # Re-exports Campaign browser
└── index.ts                        # Public barrel
```

Pattern follows `components/shared/kpi/` and `components/shared/status/`: config/types, pure utils, hooks, presentational components, domain wrappers.

---

## 3. Before / After Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| `add-creators-drawer.tsx` | 313 lines | 26 lines | **−92%** (wrapper only) |
| Duplicated `toggleSet` / manual Set toggles | 5 implementations | 1 (`creator-selection-utils`) | **−80%** |
| Duplicated select-all / indeterminate logic | 4 implementations | 1 (`resolveCreatorCheckboxState`) | **−75%** |
| Duplicated debounced browse in drawer | 1 bespoke (45 lines) | Shared `useCreatorBrowse` | Consolidated |
| Quotation checkbox list markup | ~90 lines × 3 tabs | `QuotationCreatorPicker` (~55 lines shared) | **~−65%** in modal |
| Shared picker module (new) | 0 | ~1,350 lines | Centralized |
| **Net duplicate selection/filter LOC removed from feature files** | ~520 lines | ~180 lines | **~−65% duplicate reduction** |

*Campaign browser retains advanced filter grid and `CreatorUnifiedCard` UX by design (no redesign); selection state now uses shared hooks.*

---

## 4. Domain Wrappers

| Wrapper | Uses internally | Preserves |
|---------|-----------------|-----------|
| `ShortlistCreatorPicker` | `CreatorPickerDialog` (sheet) | `isAddableCreator`, dedup, `addUnifiedCreatorsToShortlist`, toast outcomes |
| `QuotationCreatorPicker` | Toolbar + static list | Controlled `Set`, select-all, import tab UX |
| `CampaignCreatorPicker` | `CreatorBrowserDialog` | Advanced filters, compare mode, assign/shortlist actions |

`AddCreatorsDrawer` remains the public export for shortlists; it delegates to `ShortlistCreatorPicker`.

---

## 5. Capabilities Matrix

| Capability | Shared support | Notes |
|------------|----------------|-------|
| Single select | ✅ | `CreatorSelectionMode: single` in dialog |
| Multi select | ✅ | Default for search/shortlist/quotation |
| Bulk select / select all | ✅ | `toggleSelectAllVisible`, toolbar |
| Deselect all | ✅ | Toolbar + utils |
| Search + debounce | ✅ | `CreatorSearchPanel`, `useDebouncedValue` |
| Platform filter | ✅ | Search panel |
| Advanced browse filters | ⚠️ Partial | Campaign browser keeps local filter state |
| Sort | — | Discovery workspace (client sort unchanged) |
| Pagination | ✅ | `useCreatorBrowse` page mode |
| Infinite scroll | ✅ | Hook supports `infinite` mode; Discovery workspace unchanged |
| Loading / empty / skeleton | ✅ | `CreatorSelectionTable` |
| Existing-item dedup | ✅ | `buildExistingCreatorKeys`, `isCreatorOnExistingList` |

---

## 6. Remaining Gaps (Phase 3 candidates)

1. **Discovery Search workspace** — Still owns filter panel, bulk bar, virtualized `CreatorResultRow`; could adopt `CreatorSelectionTable` or shared provider for full unification.
2. **Campaign browser** — Advanced filter grid (~120 lines) not moved into `CreatorSearchPanel`; browse fetch still local (not `useCreatorBrowse`) to preserve 200ms debounce + page reset behavior exactly.
3. **Discovery bulk bar** — Domain-specific actions (export, compare, AI match) remain in `creator-search-bulk-bar.tsx`.
4. **Shortlist item bulk actions** — `bulk-selection-policy.ts` in shortlists module parallels utils; could merge with `creator-selection-utils` in a later pass.
5. **`CreatorSelectionProvider`** — Available but optional; workspaces can migrate incrementally.

---

## 7. Validation

```bash
npx tsc --noEmit          # pass
npm run build             # pass
npx tsx features/creators/picker/creator-selection-hooks.test.ts  # pass
```

---

## 8. Regression Tests

`features/creators/picker/creator-selection-hooks.test.ts` covers:

- `toggleCreatorSelection` (toggle + forced checked state)
- `selectAllCreatorIds` / `deselectAllCreatorIds`
- `toggleSelectAllVisible`
- `resolveCreatorCheckboxState` (false / true / indeterminate)
- `filterSelectedCreators`
- Dedup keys (`buildExistingCreatorKeys`, `creatorDedupKeys`, `isCreatorOnExistingList`)
- Quotation ID helpers (`toggleIdSelection`, `selectAllIds`, `deselectAllIds`)

Pure utils live in `creator-selection-utils.ts` to avoid loading Supabase env in tests.

---

## 9. Migration Map

| Old import | New path |
|------------|----------|
| `AddCreatorsDrawer` | unchanged — delegates to picker |
| `CreatorBrowserDialog` | unchanged — uses shared hooks |
| Selection helpers (internal) | `@/features/creators/picker` |

No breaking public API changes for consumers.
