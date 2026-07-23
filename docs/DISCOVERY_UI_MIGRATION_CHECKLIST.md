# Discovery UI Migration Checklist

Golden reference: **Discovery Search** (`/discovery/search`) — `CreatorSearchWorkspace`, `discovery-search-exact-*` CSS, `DiscoveryPageShell` flush variant.

Shared design system: `features/discovery/components/design-system/`  
List primitives: `features/discovery/components/discovery-list-primitives.tsx`

**Legend:** ✅ Yes · ⚠️ Partial · ❌ No · — N/A

---

## Phase 1 — Design system adoption matrix

| Page / module | Route | Shell | List primitives | Toolbar | Filters | Cards | Empty | Loading | Dialogs | Typography | Spacing | Notes |
|---------------|-------|-------|-----------------|---------|---------|-------|-------|---------|---------|------------|---------|-------|
| Creator Search | `/discovery/search` | ✅ flush | ✅ exact-row | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Golden reference |
| Browse (in Search) | `/discovery/search` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Same workspace as Search |
| Compare | `/discovery/compare` | ✅ flush | — | ✅ | — | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | Matrix UI; action bar + shared empty/loading |
| Shortlists list | `/discovery/shortlists` | ✅ list | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | Server-rendered list; client filters |
| Shortlist detail | `/discovery/shortlists/[id]` | ✅ workspace | ✅ exact-row | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Shared exact-row + meta strip |
| Quotations list | `/discovery/quotations` | ✅ list | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | Same pattern as shortlists |
| Quotation detail | `/discovery/quotations/[id]` | ✅ workspace | ❌ | ✅ | — | ⚠️ | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ | Workspace toolbar + inner class |
| Import Center | `/discovery/import` | ✅ list | ✅ | — | — | ✅ | ✅ | — | ✅ | ✅ | ✅ | Section headers + empty on design system |
| Intelligence library | `/discovery/intelligence/library` | ✅ list | ⚠️ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Filter bar + list card; row layout Phase 3 |
| Campaign Match | `/discovery/campaign-match` | ✅ flush | ✅ exact-row | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Brief match workspace |
| Creator drawer / sheet | cross-module | — | — | — | — | ⚠️ | — | ⚠️ | ⚠️ | ⚠️ | — | `creator-detail-sheet.tsx` |
| Creator hover card | Search | — | — | — | — | ✅ | — | ⚠️ | — | ✅ | — | Search CSS |
| Legacy hub | `/discovery` | ✅ | — | — | — | — | — | — | — | — | — | Redirects to `/discovery/search` |
| Export previews | `*/preview` | ❌ | — | — | — | — | — | — | — | ❌ | ❌ | Intentional iframe chrome |
| Settings engine | `/settings/discovery-engine` | ❌ | — | — | — | ❌ | — | — | ⚠️ | ❌ | ❌ | Out of Discovery nav |
| Settings diagnostics | `/settings/discovery-diagnostics` | ❌ | — | — | — | ❌ | — | — | ⚠️ | ❌ | ❌ | Out of Discovery nav |

---

## Shared design system components

| Component | Path | Status |
|-----------|------|--------|
| Page shell | `discovery-page-shell.tsx` | ✅ Exists |
| Page identity / header | `discovery-page-identity.tsx` | ✅ Exists |
| Top nav tabs | `discovery-top-nav-tabs.tsx` | ✅ Exists |
| List card + table cells | `discovery-list-primitives.tsx` | ✅ Exists |
| Design tokens | `design-system/discovery-design-tokens.ts` | ✅ **New** |
| Toolbar icons/buttons | `design-system/discovery-toolbar.tsx` | ✅ **New** |
| Filter bar chrome | `design-system/discovery-filter-bar.tsx` | ✅ **New** |
| Section header | `design-system/discovery-section-header.tsx` | ✅ **New** |
| Empty state | `design-system/discovery-empty-state.tsx` | ✅ **New** |
| Loading state | `design-system/discovery-loading-state.tsx` | ✅ **New** |
| Selection flyout | `design-system/discovery-selection-flyout.tsx` | ✅ **New** |
| Barrel export | `design-system/index.ts` | ✅ **New** |
| Exact creator row | `discovery-creator-exact-row.tsx` | ✅ **Canonical** |
| Search row alias | `creator-search/creator-search-exact-row.tsx` | ✅ Re-exports canonical |
| Interest chips | `discovery-interest-chips.tsx` | ✅ **New** |
| Legacy grid row | `creator-result-row.tsx` | ✅ Removed |
| Filter panel (drawer) | `creator-search/creator-search-filter-panel.tsx` | ✅ Uses shared `DiscoveryFilterDrawer` |
| Bulk bar | `creator-search/creator-search-bulk-bar.tsx` | ✅ Wraps `DiscoverySelectionFlyout` |
| Search list skeleton | `design-system/discovery-search-skeleton.tsx` | ✅ **New** |
| Workspace chrome | `design-system/discovery-workspace-chrome.tsx` | ✅ **New** |
| Dialog chrome | `design-system/discovery-dialog-chrome.tsx` | ✅ **New** |

**Import from:** `@/features/discovery/components/design-system`

---

## Phase 1b — Remaining standardization (before module migration)

- [x] Wire **Shortlists** + **Quotations** filter bars to `DiscoveryFilterBar`
- [x] Wire list + page empty states to `DiscoveryEmptyState` / `DiscoveryFilteredEmptyState` (preserve copy)
- [x] Wire **Compare** loading to `DiscoveryLoadingState`
- [x] Wire **Import** section headers + empty to design system
- [x] Route **Shortlists** + **Quotations** selection flyouts through `DiscoverySelectionFlyout`
- [x] Wire list loading to `DiscoveryLoadingState` / `DiscoveryListSkeleton` where client fetch exists (Search skeleton, Compare, Intelligence)
- [x] Extract **filter drawer shell** from Search → shared `DiscoveryFilterDrawer`
- [x] Align **Intelligence library** cards to `DiscoveryListCard` + section headers + filter bar
- [x] Apply **dialog chrome** pattern (`discovery-dialog-chrome`) to main Discovery dialogs (add creator, add platform, create list)
- [x] Wire **Search** result list loading/empty to design system (`DiscoverySearchExactListSkeleton`, `DiscoveryEmptyState`)
- [x] Wire **Search** bulk bar through `DiscoverySelectionFlyout`
- [x] Wire **Compare** empty + toolbar to design system (`DiscoveryEmptyState`, `DiscoveryWorkspaceActionBar`)
- [x] Wire **Shortlist** + **Quotation detail** workspaces to `DiscoveryWorkspaceToolbar` + `DISCOVERY_WORKSPACE_INNER_CLASS`
- [x] Redirect `/discovery` hub → `/discovery/search`
- [x] **Discovery UI Contract** — `docs/DISCOVERY_UI_CONTRACT.md` + CI (`test:discovery-ui-contract`)

---

## Phase 2 — Functional parity checklist (per page)

Run before signing off any migrated page:

- [ ] All buttons present and clickable
- [ ] All menus / dropdowns work
- [ ] All filters apply and clear
- [ ] All drawers / sheets open and close
- [ ] All dialogs complete their workflows
- [ ] Sidebars retain all controls
- [ ] Keyboard shortcuts unchanged
- [ ] Bulk actions + selection behavior unchanged
- [ ] Pagination / sort / search unchanged
- [ ] API calls unchanged (no new requests)
- [ ] Permissions / RLS unchanged
- [ ] No missing creator fields
- [ ] No console errors / React warnings
- [ ] No TypeScript / build errors
- [ ] Routing unchanged

**Search parity tests:** `features/discovery/components/creator-search/creator-search-row-parity.test.ts`

---

## Phase 2 — Exact-row consolidation (complete)

| Item | Status |
|------|--------|
| Canonical row: `DiscoveryCreatorExactRow` | ✅ |
| Search consumes shared row (alias `CreatorSearchExactRow`) | ✅ |
| Shortlist detail list migrated | ✅ |
| Creator selection browse lists migrated | ✅ |
| `InterestChips` extracted to `discovery-interest-chips.tsx` | ✅ |
| Legacy `CreatorResultRow` grid removed | ✅ (shim re-exports primitives only) |
| Quotation deliverable grid | — Domain-specific (header uses shared `InterestChips`) |

**Import:** `@/features/discovery/components/discovery-creator-exact-row` or `@/features/discovery/components/design-system`

---

## Phase 3 — Module unification (in progress)

| Module | ViewModel | Presentation | Status |
|--------|-----------|--------------|--------|
| Creator profile (summary/hover/sheet header) | `buildDiscoveryCreatorViewModel` | `DiscoveryCreatorProfileSummary` | ✅ |
| Creator drawer / detail | VM + `DiscoveryCreatorDetailHost` → `CreatorDetailSheet` | Shared sheet + exact-row chrome | ✅ |
| Campaign Match | `matchDiscoveryCreatorsBriefAction` | `DiscoveryCreatorExactRow` workspace | ✅ |
| AI Discovery (chat preview) | Unified batch + VM via exact row | `DiscoveryCreatorExactRow` + detail host | ✅ |
| Campaign browser cards | VM via exact row | `CreatorUnifiedCard` → exact row | ✅ |
| Studio vendor cards | Slim `DisplayVendor` slate UI | Domain layout; detail via detail host | ⚠️ Header metrics Phase 3b |

Each module must **reuse** `design-system` components — no new page-specific duplicates.

---

## Success criteria

One cohesive Discovery product: same layout, navigation, spacing, typography, and interaction patterns across all modules, with **100% functional parity** and zero regressions.
