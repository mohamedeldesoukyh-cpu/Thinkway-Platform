# DISCOVERY SHORTLISTS — Reference implementation handoff

Generated for Thinkway redesign handoff. **Full sources** for Shortlists **list** (`/discovery/shortlists`) and **detail workspace** (`/discovery/shortlists/[id]`) — aligned with Discovery Search patterns.

> Companion doc: `DISCOVERY_SEARCH_REFERENCE.md` (Search filter drawer, Search bulk bar adapter, full CSS commentary)  
> Screenshot reference: detail page with header card, Creators (N) toolbar, exact-row list, Generate Campaign Outputs panel.

---

## Index

| Route | `page.tsx` | Main UI |
|-------|-------------|---------|
| List | `app/(dashboard)/discovery/shortlists/page.tsx` | `ShortlistsList` + `ShortlistListFilterBar` |
| Detail | `app/(dashboard)/discovery/shortlists/[id]/page.tsx` | `ShortlistWorkspace` + `ShortlistCreatorList` |

| Pattern | Shortlists implementation |
|---------|---------------------------|
| Page shell (list) | `DiscoveryPageShell` variant `list` — lavender canvas |
| Page shell (detail) | `DiscoveryPageShell` variant `workspace` + `DiscoveryWorkspaceToolbar` |
| Creator rows | `DiscoveryCreatorExactRow` / `DiscoveryCreatorExactHeader` |
| List filter UI | `DiscoveryFilterBar` embedded strip (search + status selects) — **not** Search filter drawer |
| Add creators | `AddCreatorsDrawer` → `ShortlistCreatorPicker` sheet |
| Bulk bar (list) | `ShortlistSelectionFlyout` → `DiscoverySelectionFlyout` |
| Bulk bar (detail) | `ShortlistBulkToolbar` → `DiscoverySelectionFlyout` |
| Row ⋯ menu (list) | Inline `DropdownMenu` in `shortlists-list.tsx` |
| Row ⋯ menu (detail) | Inline `RowActions` in `shortlist-creator-list.tsx` |
| Sidebar | `CollapsibleAppSidebar` — shared with all dashboard routes |

---

## Shortlists vs Search — pattern mapping

| Search | Shortlists list | Shortlists detail |
|--------|-----------------|-------------------|
| `CreatorSearchFilterPanel` + `DiscoveryFilterSheet` | `ShortlistListFilterBar` (inline filters) | N/A |
| `CreatorSearchBulkBar` | `ShortlistSelectionFlyout` | `ShortlistBulkToolbar` |
| `DiscoveryCreatorActionsMenu` | Row `DropdownMenu` in list table | `RowActions` dropdown in creator list |
| Virtualized `CreatorSearchResultList` | HTML `<Table>` in `ShortlistsList` | `ShortlistCreatorList` exact-row scroll region |
| URL-synced filter state | Client `ShortlistListFilterState` | Server-loaded `ShortlistDetail` |

---

## Detail creator list — scroll region

Creator list uses `.discovery-search-exact-scroll` with `max-h-[min(70vh,960px)]` so mouse wheel scroll works inside the card (same fix as Campaign Match). Without max-height, `overscroll-behavior-y: contain` traps wheel events.

```tsx
// shortlist-creator-list.tsx
<div className="discovery-search-exact-scroll max-h-[min(70vh,960px)] overscroll-y-auto">
```

---

## Bulk selection — behavior

### List (`ShortlistsList`)

- Checkbox column + `ShortlistSelectionFlyout` when `selectedCount > 0`
- Actions resolved by `shortlist-list-actions.ts` from selected row statuses
- Card gets bottom padding via `shortlistListFloatingBarContentClass(selectedCount > 0)`

### Detail (`ShortlistWorkspace`)

- `ShortlistBulkToolbar` maps creator bulk actions (submit, approve, compare, export, quotation, …)
- `discoverySelectionFlyoutContentClass(selectedCount > 0)` on creators card

---

## Row overflow menus

### List table (per shortlist row)

Implemented inside `shortlists-list.tsx`: `DropdownMenu` with Open + status actions from `actionsForShortlistStatus`.

### Detail creator row

`RowActions` in `shortlist-creator-list.tsx`: Add to quotation, Delete creator, Remove from shortlist. Uses shadcn `DropdownMenu`, class `discovery-search-exact-row-menu`.

Search uses the richer `DiscoveryCreatorActionsMenu` — included in §8 for comparison when aligning patterns.

---

## Sidebar & hover delays

Same as Search handoff:

| Interaction | Delay | File |
|-------------|-------|------|
| Collapsed rail tooltips | **300ms** | `collapsible-app-sidebar.tsx` `TooltipProvider delayDuration={300}` |
| Sidebar expand/collapse | **Click** | PanelLeftOpen / PanelLeftClose |
| Creator avatar preview on exact rows | **1000ms** | `creator-avatar-hover-trigger.tsx` `useDelayedHover(1000)` |
| Hook default (unused on Search rows) | **2000ms** | `use-delayed-hover.ts` |

---

## Design token drift checklist

Same sources as Search — Shortlists list mixes `var(--text-2)`, `bg-background`, `bg-muted/40`, and `DISCOVERY_LIST_CARD_CLASS`. Detail workspace uses `bg-[var(--camp-surface)]` canvas from `DiscoveryPageShell` workspace variant.

| Token | Shortlists usage |
|-------|------------------|
| `--lavender` | List page canvas (`DiscoveryPageShell` list variant) |
| `--camp-surface` | Detail workspace scroll region |
| `--tw-border` | List card borders, filter bar |
| `discovery-search-exact-*` CSS | Detail creator rows (platform-v6.css) |

---


---

## 1 — Shortlists list route

List page at `/discovery/shortlists` — lavender canvas, filter bar, table, row overflow menu.

#### `app/(dashboard)/discovery/shortlists/page.tsx`

```tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DiscoveryEmptyState,
  DiscoveryListCard,
} from "@/features/discovery/components/design-system";
import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
import { CreateShortlistDialog } from "@/features/discovery/shortlists/components/create-shortlist-dialog";
import { ShortlistsList } from "@/features/discovery/shortlists/components/shortlists-list";
import {
  getDiscoveryShortlistsV2,
  getShortlistBrandOptions,
} from "@/features/discovery/shortlists/queries";
import type {
  ShortlistBrandOption,
  ShortlistListRow,
} from "@/features/discovery/shortlists/types";

export default async function DiscoveryShortlistsPage() {
  let shortlists: ShortlistListRow[] = [];
  let brands: ShortlistBrandOption[] = [];
  let errorMessage: string | null = null;

  try {
    [shortlists, brands] = await Promise.all([
      getDiscoveryShortlistsV2(),
      getShortlistBrandOptions(),
    ]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Failed to load shortlists.";
  }

  return (
    <DiscoveryPageShell
      page="shortlists"
      headerActions={<CreateShortlistDialog brands={brands} />}
    >
      {errorMessage ? (
        <div className="rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : shortlists.length === 0 ? (
        <DiscoveryListCard className="border-dashed">
          <DiscoveryEmptyState
            title="No shortlists yet"
            description="Create a shortlist, then add creators from Search or Compare."
          >
            <Button asChild variant="secondary">
              <Link href="/discovery/search">Open Creator Search</Link>
            </Button>
          </DiscoveryEmptyState>
        </DiscoveryListCard>
      ) : (
        <ShortlistsList shortlists={shortlists} brands={brands} />
      )}
    </DiscoveryPageShell>
  );
}
```

#### `features/discovery/shortlists/components/shortlists-list.tsx`

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  approveShortlist,
  archiveShortlist,
  cancelShortlist,
  rejectShortlist,
  reopenShortlist,
  submitShortlistForReview,
} from "../actions";
import {
  countSelected,
  isAllVisibleSelected,
  isIndeterminateSelection,
  pruneSelection,
  toggleItemSelection,
  toggleSelectAll,
} from "../bulk-selection-policy";
import {
  actionsForShortlistStatus,
  resolveBulkShortlistActions,
  type ShortlistListActionDef,
  type ShortlistListActionKey,
} from "../shortlist-list-actions";
import {
  DEFAULT_SHORTLIST_LIST_FILTERS,
  filterShortlistRows,
  type ShortlistListFilterState,
} from "../shortlist-list-filters";
import type { ShortlistBrandOption, ShortlistListRow } from "../types";
import {
  ShortlistStatusBadge,
  ShortlistVisibilityBadge,
} from "./shortlist-badges";
import { ShortlistListFilterBar } from "./shortlist-list-filter-bar";
import {
  ShortlistSelectionFlyout,
  shortlistListFloatingBarContentClass,
} from "./shortlist-selection-flyout";
import {
  InitialsAvatar,
  ShortlistCreatorPreviewStack,
} from "./shortlist-row-visuals";

import {
  DISCOVERY_LIST_CARD_CLASS,
  DISCOVERY_TABLE_CELL_CLASS,
  DISCOVERY_TABLE_HEAD_CLASS,
  DISCOVERY_TABLE_ROW_CLASS,
  DiscoveryFilteredEmptyState,
} from "@/features/discovery/components/design-system";

const LIST_ACTION_RUNNERS: Record<
  ShortlistListActionKey,
  (id: string) => Promise<{ ok: boolean; message?: string }>
> = {
  submit_for_review: submitShortlistForReview,
  approve: approveShortlist,
  return_to_draft: rejectShortlist,
  reopen: reopenShortlist,
  cancel: cancelShortlist,
  archive: archiveShortlist,
};

type Props = {
  shortlists: ShortlistListRow[];
  brands?: ShortlistBrandOption[];
};

export function ShortlistsList({ shortlists, brands = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<ShortlistListFilterState>(
    DEFAULT_SHORTLIST_LIST_FILTERS
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredShortlists = useMemo(
    () => filterShortlistRows(shortlists, filters),
    [shortlists, filters]
  );

  const visibleIds = useMemo(
    () => filteredShortlists.map((row) => row.id),
    [filteredShortlists]
  );

  const effectiveSelectedIds = useMemo(
    () => pruneSelection(selectedIds, visibleIds),
    [selectedIds, visibleIds]
  );

  const selectedCount = countSelected(effectiveSelectedIds);
  const allSelected = isAllVisibleSelected(visibleIds, effectiveSelectedIds);
  const indeterminate = isIndeterminateSelection(visibleIds, effectiveSelectedIds);

  const selectedRows = useMemo(
    () => filteredShortlists.filter((row) => effectiveSelectedIds.has(row.id)),
    [filteredShortlists, effectiveSelectedIds]
  );

  const bulkActions = useMemo(
    () => resolveBulkShortlistActions(selectedRows.map((row) => row.status)),
    [selectedRows]
  );

  const runAction = useCallback(
    (action: () => Promise<{ ok: boolean; message?: string }>) => {
      startTransition(async () => {
        try {
          const result = await action();
          if (result.ok) {
            toast.success(result.message ?? "Done");
            router.refresh();
          } else {
            toast.error(result.message ?? "Action failed");
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Action failed");
        }
      });
    },
    [router]
  );

  const runRowAction = useCallback(
    (row: ShortlistListRow, def: ShortlistListActionDef) => {
      runAction(() => LIST_ACTION_RUNNERS[def.key](row.id));
    },
    [runAction]
  );

  const runBulkAction = useCallback(
    (def: ShortlistListActionDef) => {
      const ids = selectedRows.map((row) => row.id);
      startTransition(async () => {
        let updated = 0;
        let skipped = 0;
        let lastError: string | undefined;

        for (const id of ids) {
          const row = selectedRows.find((item) => item.id === id);
          if (!row || !def.show(row.status)) {
            skipped += 1;
            continue;
          }
          try {
            const result = await LIST_ACTION_RUNNERS[def.key](id);
            if (result.ok) updated += 1;
            else {
              skipped += 1;
              lastError = result.message;
            }
          } catch (error) {
            skipped += 1;
            lastError = error instanceof Error ? error.message : "Action failed";
          }
        }

        if (updated > 0) {
          toast.success(
            `${updated} shortlist${updated === 1 ? "" : "s"} ${def.label.toLowerCase()}.` +
              (skipped > 0 ? ` ${skipped} skipped.` : "")
          );
          setSelectedIds(new Set());
          router.refresh();
        } else {
          toast.error(lastError ?? "No shortlists were updated.");
        }
      });
    },
    [router, selectedRows]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds((prev) => toggleSelectAll(visibleIds, prev, true));
  }, [visibleIds]);

  const actionsFor = (row: ShortlistListRow): ShortlistListActionDef[] =>
    actionsForShortlistStatus(row.status);

  const showFloatingBar = selectedCount > 0;

  return (
    <div className="space-y-0">
      <div
        className={cn(
          DISCOVERY_LIST_CARD_CLASS,
          shortlistListFloatingBarContentClass(showFloatingBar)
        )}
      >
        <ShortlistListFilterBar
          filters={filters}
          onChange={setFilters}
          brands={brands}
          resultCount={filteredShortlists.length}
          totalCount={shortlists.length}
          embedded
        />

        {filteredShortlists.length === 0 ? (
          <DiscoveryFilteredEmptyState
            title="No shortlists match your filters"
            onReset={() => setFilters(DEFAULT_SHORTLIST_LIST_FILTERS)}
          />
        ) : (
          <Table variant="flush">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-0">
                <TableHead className={cn(DISCOVERY_TABLE_HEAD_CLASS, "w-[34px]")}>
                  <Checkbox
                    checked={allSelected ? true : indeterminate ? "indeterminate" : false}
                    onCheckedChange={(value) =>
                      setSelectedIds((prev) =>
                        toggleSelectAll(visibleIds, prev, Boolean(value))
                      )
                    }
                    aria-label="Select all shortlists"
                    disabled={isPending}
                  />
                </TableHead>
                <TableHead className={DISCOVERY_TABLE_HEAD_CLASS}>Serial</TableHead>
                <TableHead className={DISCOVERY_TABLE_HEAD_CLASS}>Shortlist</TableHead>
                <TableHead className={DISCOVERY_TABLE_HEAD_CLASS}>Status</TableHead>
                <TableHead className={DISCOVERY_TABLE_HEAD_CLASS}>Visibility</TableHead>
                <TableHead className={DISCOVERY_TABLE_HEAD_CLASS}>Owner</TableHead>
                <TableHead className={DISCOVERY_TABLE_HEAD_CLASS}>Creators</TableHead>
                <TableHead className={DISCOVERY_TABLE_HEAD_CLASS}>Updated</TableHead>
                <TableHead className={cn(DISCOVERY_TABLE_HEAD_CLASS, "w-12")} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShortlists.map((row) => {
                const actions = actionsFor(row);
                const ownerLabel = row.owner_name ?? "Unknown";
                const isSelected = effectiveSelectedIds.has(row.id);

                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={DISCOVERY_TABLE_ROW_CLASS}
                  >
                    <TableCell className={cn(DISCOVERY_TABLE_CELL_CLASS, "w-[34px]")}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(value) =>
                          setSelectedIds((prev) =>
                            toggleItemSelection(prev, row.id, Boolean(value))
                          )
                        }
                        aria-label={`Select ${row.name}`}
                        disabled={isPending}
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        DISCOVERY_TABLE_CELL_CLASS,
                        "font-mono text-[11.5px] font-bold text-[var(--text)]"
                      )}
                    >
                      {row.serial_number ?? "—"}
                    </TableCell>
                    <TableCell className={DISCOVERY_TABLE_CELL_CLASS}>
                      <div className="flex min-w-0 items-center gap-[9px]">
                        <InitialsAvatar
                          name={row.name}
                          seed={row.id}
                          sizeClass="size-[30px] text-[11px]"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/discovery/shortlists/${row.id}`}
                            className="block truncate text-[12.5px] font-semibold text-[var(--blue-text)] hover:underline"
                          >
                            {row.name}
                          </Link>
                          {row.brand_name ? (
                            <span className="block truncate text-xs text-[var(--text-3)]">
                              {row.brand_name}
                              {row.client_name ? ` · ${row.client_name}` : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={DISCOVERY_TABLE_CELL_CLASS}>
                      <ShortlistStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className={DISCOVERY_TABLE_CELL_CLASS}>
                      <ShortlistVisibilityBadge visibility={row.visibility} />
                    </TableCell>
                    <TableCell className={DISCOVERY_TABLE_CELL_CLASS}>
                      <div className="flex min-w-0 items-center gap-2">
                        <InitialsAvatar
                          name={ownerLabel}
                          seed={row.owner_id}
                          sizeClass="size-6 text-[9.5px]"
                        />
                        <span className="truncate text-[12.5px] text-[var(--text-2)]">
                          {row.owner_name ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={DISCOVERY_TABLE_CELL_CLASS}>
                      <ShortlistCreatorPreviewStack
                        previews={row.creator_previews}
                        totalCount={row.creator_count}
                        align="start"
                        overflowVariant="solid"
                      />
                    </TableCell>
                    <TableCell className={cn(DISCOVERY_TABLE_CELL_CLASS, "text-[var(--text-3)]")}>
                      {row.updated_at
                        ? format(new Date(row.updated_at), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className={cn(DISCOVERY_TABLE_CELL_CLASS, "w-12")}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            aria-label="Shortlist actions"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/discovery/shortlists/${row.id}`}>Open</Link>
                          </DropdownMenuItem>
                          {actions.length > 0 ? <DropdownMenuSeparator /> : null}
                          {actions.map((action) => (
                            <DropdownMenuItem
                              key={action.key}
                              variant={action.destructive ? "destructive" : "default"}
                              onSelect={(event) => {
                                event.preventDefault();
                                runRowAction(row, action);
                              }}
                            >
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ShortlistSelectionFlyout
        selectedCount={selectedCount}
        selectableCount={visibleIds.length}
        actions={bulkActions}
        busy={isPending}
        onSelectAll={selectAllVisible}
        onClearSelection={clearSelection}
        onAction={runBulkAction}
      />
    </div>
  );
}
```

#### `features/discovery/shortlists/components/shortlist-list-filter-bar.tsx`

```tsx
"use client";

import { RotateCcwIcon } from "lucide-react";

import { OperationalTableSearchField } from "@/components/tables/operational-table-chrome";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DiscoveryFilterBar } from "@/features/discovery/components/design-system";
import { cn } from "@/lib/utils";
import type { ShortlistStatus, ShortlistVisibilityV2 } from "@/types/database";

import {
  SHORTLIST_STATUSES,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITIES,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";
import {
  DEFAULT_SHORTLIST_LIST_FILTERS,
  hasActiveShortlistListFilters,
  type ShortlistListFilterState,
} from "../shortlist-list-filters";
import type { ShortlistBrandOption } from "../types";

type Props = {
  filters: ShortlistListFilterState;
  onChange: (filters: ShortlistListFilterState) => void;
  brands?: ShortlistBrandOption[];
  resultCount: number;
  totalCount: number;
  className?: string;
  /** When true, omits outer chrome — parent card supplies border/radius. */
  embedded?: boolean;
};

export function ShortlistListFilterBar({
  filters,
  onChange,
  brands = [],
  resultCount,
  totalCount,
  className,
  embedded = false,
}: Props) {
  const showBrandFilter = brands.length > 0;
  const hasFilters = hasActiveShortlistListFilters(filters);
  const countLabel =
    resultCount === totalCount
      ? `${totalCount} shortlist${totalCount === 1 ? "" : "s"}`
      : `${resultCount} of ${totalCount}`;

  return (
    <DiscoveryFilterBar embedded={embedded} className={className}>
      <div className={cn(embedded && "min-w-[220px] flex-1")}>
        <OperationalTableSearchField
          value={filters.search}
          onChange={(search) => onChange({ ...filters, search })}
          onClear={() => onChange({ ...filters, search: "" })}
          placeholder="Search name or serial…"
          variant={embedded ? "boxed" : "ghost"}
        />
      </div>

      <Select
        value={filters.status}
        onValueChange={(status) =>
          onChange({ ...filters, status: status as ShortlistStatus | "all" })
        }
      >
        <SelectTrigger
          className={cn(
            "h-9 min-w-[130px] rounded-[var(--tw-radius)] border-[var(--tw-border)] bg-background text-[12.5px] font-semibold text-[var(--text-2)]",
            !embedded && "h-8 w-[9.5rem]"
          )}
        >
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {SHORTLIST_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {SHORTLIST_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.visibility}
        onValueChange={(visibility) =>
          onChange({
            ...filters,
            visibility: visibility as ShortlistVisibilityV2 | "all",
          })
        }
      >
        <SelectTrigger
          className={cn(
            "h-9 min-w-[130px] rounded-[var(--tw-radius)] border-[var(--tw-border)] bg-background text-[12.5px] font-semibold text-[var(--text-2)]",
            !embedded && "h-8 w-[9.5rem]"
          )}
        >
          <SelectValue placeholder="Visibility" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All visibility</SelectItem>
          {SHORTLIST_VISIBILITIES.map((visibility) => (
            <SelectItem key={visibility} value={visibility}>
              {SHORTLIST_VISIBILITY_LABELS[visibility]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showBrandFilter ? (
        <Select
          value={filters.brandId}
          onValueChange={(brandId) => onChange({ ...filters, brandId })}
        >
          <SelectTrigger
            className={cn(
              "h-9 min-w-[130px] max-w-[14rem] rounded-[var(--tw-radius)] border-[var(--tw-border)] bg-background text-[12.5px] font-semibold text-[var(--text-2)]",
              !embedded && "h-8 min-w-[9.5rem]"
            )}
          >
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
                {brand.client_name ? ` · ${brand.client_name}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <span
        className={cn(
          "text-xs font-semibold text-[var(--text-3)]",
          embedded ? "ml-auto" : "ml-auto text-[11px]"
        )}
      >
        {countLabel}
      </span>

      {hasFilters ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="h-7 gap-1 text-[11px] text-muted-foreground"
          onClick={() => onChange(DEFAULT_SHORTLIST_LIST_FILTERS)}
        >
          <RotateCcwIcon className="size-3" />
          Reset
        </Button>
      ) : null}
    </DiscoveryFilterBar>
  );
}
```

#### `features/discovery/shortlists/components/shortlist-list-actions.ts`

```ts
/* FILE NOT FOUND: features/discovery/shortlists/components/shortlist-list-actions.ts */
```

#### `features/discovery/shortlists/components/shortlist-list-filters.ts`

```ts
/* FILE NOT FOUND: features/discovery/shortlists/components/shortlist-list-filters.ts */
```

#### `features/discovery/shortlists/components/shortlist-row-visuals.tsx`

```tsx
"use client";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";
import { cn } from "@/lib/utils";

import type { ShortlistCreatorPreview } from "../types";

const AVATAR_GRADIENTS = [
  {
    gradient: "from-sky-300/80 via-sky-400/45 to-blue-400/30",
    textClass: "text-sky-900 dark:text-sky-100",
  },
  {
    gradient: "from-amber-300/80 via-amber-400/45 to-orange-400/30",
    textClass: "text-amber-900 dark:text-amber-100",
  },
  {
    gradient: "from-rose-300/80 via-rose-400/45 to-pink-400/30",
    textClass: "text-rose-900 dark:text-rose-100",
  },
  {
    gradient: "from-violet-300/80 via-violet-400/45 to-purple-400/30",
    textClass: "text-violet-900 dark:text-violet-100",
  },
] as const;

function gradientForIndex(index: number) {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
}

function hashIndex(seed: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

type InitialsAvatarProps = {
  name: string;
  seed?: string;
  sizeClass?: string;
  textClass?: string;
  className?: string;
};

export function InitialsAvatar({
  name,
  seed,
  sizeClass = "size-10",
  className,
}: InitialsAvatarProps) {
  const palette = gradientForIndex(hashIndex(seed ?? name, AVATAR_GRADIENTS.length));
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br text-[11px] font-semibold shadow-sm ring-2 ring-background",
        "dark:border-white/15",
        sizeClass,
        palette.gradient,
        palette.textClass,
        className
      )}
      aria-hidden
    >
      {initialsFromCreatorName(name)}
    </span>
  );
}

export function ShortlistCreatorPreviewStack({
  previews,
  totalCount,
  className,
  align = "end",
  overflowVariant = "muted",
}: {
  previews: ShortlistCreatorPreview[];
  totalCount: number;
  className?: string;
  align?: "start" | "end";
  overflowVariant?: "muted" | "solid";
}) {
  if (totalCount === 0) {
    return (
      <span className="text-xs tabular-nums text-muted-foreground">0</span>
    );
  }

  const visible = previews.slice(0, 4);
  const overflow = totalCount - visible.length;

  return (
    <div
      className={cn(
        "flex items-center",
        align === "start" ? "justify-start" : "justify-end",
        className
      )}
    >
      {visible.length > 0 ? (
        <div className="flex items-center" aria-hidden>
          {visible.map((preview, index) => {
            const palette = gradientForIndex(index);
            const hasImage = Boolean(preview.profile_image_url?.trim());
            return (
              <span
                key={`${preview.display_name}-${index}`}
                className={cn(
                  /* HTML `.creator-chip`: 26px, border 2px white, overlap -8px */
                  "relative inline-flex size-[26px] overflow-hidden rounded-full border-2 border-white bg-[var(--surface)]",
                  "dark:border-background",
                  index > 0 && "-ml-2"
                )}
                style={{ zIndex: visible.length - index }}
              >
                {hasImage ? (
                  <CreatorAvatarImage
                    avatarUrl={preview.profile_image_url}
                    sizeClassName="size-[26px]"
                    className="rounded-full"
                  />
                ) : (
                  <span
                    className={cn(
                      "flex size-[26px] items-center justify-center bg-gradient-to-br text-[9px] font-bold",
                      palette.gradient,
                      palette.textClass
                    )}
                  >
                    {initialsFromCreatorName(preview.display_name)}
                  </span>
                )}
              </span>
            );
          })}
          {overflow > 0 ? (
            <span
              className={cn(
                "relative -ml-2 inline-flex size-[26px] items-center justify-center rounded-full border-2 border-white text-[9px] font-bold dark:border-background",
                overflowVariant === "solid"
                  ? "bg-[var(--ink)] text-white"
                  : "border-dashed border-border bg-muted/80 font-medium text-muted-foreground"
              )}
              style={{ zIndex: 0 }}
            >
              +{overflow}
            </span>
          ) : null}
        </div>
      ) : null}
      <span
        className={cn(
          "ml-2 text-[10.5px] font-bold tabular-nums",
          overflowVariant === "solid"
            ? "text-[var(--text-3)]"
            : "text-foreground"
        )}
      >
        {totalCount}
      </span>
    </div>
  );
}
```

#### `features/discovery/shortlists/components/shortlist-badges.tsx`

```tsx
import Link from "next/link";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { Badge } from "@/components/ui/badge";
import {
  QUOTATION_STATUS_LABELS,
  quotationDetailPath,
} from "@/features/quotations/constants";
import { cn } from "@/lib/utils";
import type {
  CampaignShortlistAssignmentStatus,
  ShortlistItemStatus,
  ShortlistStatus,
  ShortlistVisibilityV2,
} from "@/types/database";

import {
  ASSIGNMENT_STATUS_LABELS,
  SHORTLIST_ITEM_STATUS_LABELS,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";
import type { ShortlistCreatorQuotationRef } from "../types";

export function ShortlistStatusBadge({ status }: { status: ShortlistStatus }) {
  return (
    <StatusBadge
      label={SHORTLIST_STATUS_LABELS[status]}
      tone={resolveStatusTone("shortlist", status)}
      appearance="ghost"
      className={cn(status === "archived" && "line-through")}
    />
  );
}

export function ShortlistVisibilityBadge({
  visibility,
}: {
  visibility: ShortlistVisibilityV2;
}) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {SHORTLIST_VISIBILITY_LABELS[visibility]}
    </Badge>
  );
}

export function ShortlistItemStatusBadge({
  status,
  variant = "default",
}: {
  status: ShortlistItemStatus;
  variant?: "default" | "table";
}) {
  if (variant === "table") {
    return (
      <span
        className={cn(
          "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold",
          status === "draft" && "border-border bg-muted/60 text-muted-foreground",
          status === "under_review" &&
            "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
          status === "approved" &&
            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
          status === "rejected" &&
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
          (status === "moved_to_campaign" || status === "cancelled") &&
            "border-border bg-muted/60 text-muted-foreground",
          status === "cancelled" && "line-through"
        )}
      >
        {SHORTLIST_ITEM_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <StatusBadge
      label={SHORTLIST_ITEM_STATUS_LABELS[status]}
      tone={resolveStatusTone("shortlistItem", status)}
      appearance="ghost"
      className={cn(status === "cancelled" && "line-through")}
    />
  );
}

export function AssignmentStatusBadge({
  status,
}: {
  status: CampaignShortlistAssignmentStatus | null;
}) {
  if (!status) return null;
  return (
    <StatusBadge
      label={ASSIGNMENT_STATUS_LABELS[status]}
      tone={resolveStatusTone("shortlistAssignment", status)}
      appearance="ghost"
      className={cn(status === "removed" && "line-through")}
    />
  );
}

function quotationBadgeLabel(ref: ShortlistCreatorQuotationRef): string {
  if (ref.serial_number?.trim()) return ref.serial_number.trim();
  return ref.name.trim() || "Quotation";
}

export function ShortlistCreatorQuotedBadge({
  refs,
  variant = "table",
}: {
  refs: ShortlistCreatorQuotationRef[];
  variant?: "default" | "table";
}) {
  if (refs.length === 0) {
    return variant === "table" ? (
      <span className="text-[11px] text-muted-foreground/50">—</span>
    ) : null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {refs.map((ref) => (
        <Link
          key={ref.quotation_id}
          href={quotationDetailPath(ref.quotation_id)}
          title={`${quotationBadgeLabel(ref)} · ${QUOTATION_STATUS_LABELS[ref.status]}`}
          className="inline-flex max-w-full"
          onClick={(event) => event.stopPropagation()}
        >
          <span
            className={cn(
              "inline-flex h-5 max-w-full items-center truncate rounded-full border px-2 text-[10px] font-semibold",
              "border-[#1D9E75]/25 bg-[#1D9E75]/10 text-[#1D9E75]",
              "hover:bg-[#1D9E75]/15 dark:border-[#1D9E75]/35 dark:bg-[#1D9E75]/15"
            )}
          >
            Quoted
            <span className="mx-1 opacity-40">·</span>
            <span className="truncate">{quotationBadgeLabel(ref)}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
```

#### `features/discovery/shortlists/components/shortlist-selection-flyout.tsx`

```tsx
"use client";

import {
  DiscoverySelectionFlyout,
  discoverySelectionFlyoutContentClass,
  type DiscoverySelectionFlyoutAction,
} from "@/features/discovery/components/design-system";

import type { ShortlistListActionDef } from "../shortlist-list-actions";

type Props = {
  selectedCount: number;
  selectableCount: number;
  actions: ShortlistListActionDef[];
  busy?: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onAction: (action: ShortlistListActionDef) => void;
};

export function ShortlistSelectionFlyout({
  selectedCount,
  selectableCount,
  actions,
  busy,
  onSelectAll,
  onClearSelection,
  onAction,
}: Props) {
  const flyoutActions: DiscoverySelectionFlyoutAction[] = actions.map((action) => ({
    id: action.key,
    label: action.label,
    variant: action.destructive ? "outline" : "primary",
    destructive: action.destructive,
    onClick: () => onAction(action),
  }));

  return (
    <DiscoverySelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="shortlist"
      actions={flyoutActions}
      onClearSelection={onClearSelection}
      onSelectAll={onSelectAll}
      selectableCount={selectableCount}
      busy={busy}
      emptyActionsMessage={
        actions.length === 0 ? "No shared actions for this selection" : undefined
      }
      maxVisibleActions={3}
    />
  );
}

export { discoverySelectionFlyoutContentClass as shortlistListFloatingBarContentClass };
```

#### `features/discovery/shortlists/components/create-shortlist-dialog.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ListPlusIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";
import { cn } from "@/lib/utils";
import type { ShortlistVisibilityV2 } from "@/types/database";

import { createShortlistV2 } from "../actions";
import {
  SELECTABLE_SHORTLIST_VISIBILITIES,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";
import type { ShortlistBrandOption } from "../types";

const NO_BRAND = "__none__";

const SHORTLIST_PREVIEW_CREATORS = [
  {
    name: "Amira Khan",
    gradient: "from-sky-300/70 via-sky-400/40 to-blue-400/25",
    textClass: "text-sky-900 dark:text-sky-100",
  },
  {
    name: "Marcus Rivera",
    gradient: "from-amber-300/70 via-amber-400/40 to-orange-400/25",
    textClass: "text-amber-900 dark:text-amber-100",
  },
  {
    name: "Jade Stone",
    gradient: "from-rose-300/70 via-rose-400/40 to-pink-400/25",
    textClass: "text-rose-900 dark:text-rose-100",
  },
  {
    name: "Leo Park",
    gradient: "from-violet-300/70 via-violet-400/40 to-purple-400/25",
    textClass: "text-violet-900 dark:text-violet-100",
  },
] as const;

function ShortlistPreviewAvatarStack() {
  return (
    <div className="flex shrink-0 items-center" aria-hidden>
      <span className="sr-only">Preview of creators you will save to this shortlist</span>
      {SHORTLIST_PREVIEW_CREATORS.map((creator, index) => (
        <span
          key={creator.name}
          className={cn(
            "relative inline-flex size-7 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br text-[10px] font-semibold shadow-sm",
            "ring-2 ring-white/90 dark:border-white/20 dark:ring-[rgba(24,24,27,0.9)]",
            creator.gradient,
            creator.textClass,
            index > 0 && "-ml-2"
          )}
          style={{ zIndex: SHORTLIST_PREVIEW_CREATORS.length - index }}
        >
          {initialsFromCreatorName(creator.name)}
        </span>
      ))}
      <span
        className={cn(
          "relative -ml-2 z-0 inline-flex size-7 items-center justify-center rounded-full",
          "border border-dashed border-[#1D9E75]/40 bg-[#1D9E75]/8 ring-2 ring-white/90",
          "text-[#1D9E75] dark:border-[#1D9E75]/50 dark:bg-[#1D9E75]/12 dark:ring-[rgba(24,24,27,0.9)]"
        )}
      >
        <ListPlusIcon className="size-3.5" aria-hidden />
      </span>
    </div>
  );
}

export function CreateShortlistDialog({
  brands,
  trigger,
}: {
  brands: ShortlistBrandOption[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ShortlistVisibilityV2>("private");
  const [brandId, setBrandId] = useState<string>(NO_BRAND);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setDescription("");
    setVisibility("private");
    setBrandId(NO_BRAND);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Shortlist name is required");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createShortlistV2({
          name: trimmed,
          description: description.trim() || null,
          visibility,
          brandId: brandId === NO_BRAND ? null : brandId,
        });
        toast.success(
          `Shortlist ${created.serial_number ?? ""} "${created.name}" created`.trim()
        );
        setOpen(false);
        reset();
        router.push(`/discovery/shortlists/${created.id}`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create shortlist");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            className="h-9 gap-[7px] border-0 px-3.5 text-[12.5px] font-bold text-white shadow-[0_6px_16px_rgba(0,87,255,0.22)] hover:brightness-105"
            style={{ backgroundImage: "var(--tw-brand-gradient)" }}
          >
            <ListPlusIcon className="size-3.5" strokeWidth={2.4} />
            New Shortlist
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        overlayClassName="!bg-transparent bg-[radial-gradient(ellipse_90%_80%_at_50%_35%,rgba(15,23,42,0.05),rgba(15,23,42,0.02)_42%,transparent_72%)] supports-backdrop-filter:backdrop-blur-none dark:bg-[radial-gradient(ellipse_90%_80%_at_50%_35%,rgba(0,0,0,0.18),rgba(0,0,0,0.06)_42%,transparent_72%)]"
        className={cn(
          "overflow-hidden border border-white/70 bg-white/75 shadow-[0_24px_64px_-14px_rgba(15,23,42,0.16),0_10px_28px_-10px_rgba(15,23,42,0.08),0_0_0_1px_rgba(255,255,255,0.55)_inset]",
          "ring-1 ring-black/[0.04] backdrop-blur-2xl backdrop-saturate-150",
          "dark:border-white/10 dark:bg-[rgba(24,24,27,0.72)] dark:shadow-[0_24px_64px_-14px_rgba(0,0,0,0.55),0_10px_28px_-10px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.05)_inset] dark:ring-white/[0.06] dark:backdrop-blur-2xl",
          "duration-200 data-open:zoom-in-[0.97] sm:max-w-lg"
        )}
      >
        <DialogHeader className="gap-2">
          <div className="flex items-start gap-3">
            <ShortlistPreviewAvatarStack />
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle>Create shortlist</DialogTitle>
              <DialogDescription>
                Save discovered creators into a reviewable, approvable shortlist. A
                permanent SL serial is assigned automatically.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="shortlist-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="shortlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Q3 Beauty Shortlist"
              autoFocus
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shortlist-description">Description</Label>
            <Textarea
              id="shortlist-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes about this list"
              rows={2}
              disabled={isPending}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="shortlist-visibility">Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(value) => setVisibility(value as ShortlistVisibilityV2)}
                disabled={isPending}
              >
                <SelectTrigger
                  id="shortlist-visibility"
                  className="w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTABLE_SHORTLIST_VISIBILITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {SHORTLIST_VISIBILITY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="shortlist-brand">Brand (optional)</Label>
              <Select value={brandId} onValueChange={setBrandId} disabled={isPending}>
                <SelectTrigger
                  id="shortlist-brand"
                  className="w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
                >
                  <SelectValue placeholder="No brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BRAND}>No brand</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id} className="truncate">
                      {brand.client_name ? `${brand.name} · ${brand.client_name}` : brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Create shortlist
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```


---

## 2 — Shortlist detail route

Detail workspace at `/discovery/shortlists/[id]` — header card, creator exact rows, bulk bar, Generate Outputs launcher in toolbar.

#### `app/(dashboard)/discovery/shortlists/[id]/page.tsx`

```tsx
import { notFound } from "next/navigation";

import {
  DISCOVERY_WORKSPACE_INNER_CLASS,
  DiscoveryWorkspaceToolbar,
} from "@/features/discovery/components/design-system";
import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
import { ShortlistWorkspace } from "@/features/discovery/shortlists/components/shortlist-workspace";
import {
  getShortlistBrandOptions,
  getShortlistCampaignOptions,
  getShortlistClientOptions,
  getShortlistDetail,
} from "@/features/discovery/shortlists/queries";
import { GenerateOutputsLauncher } from "@/features/campaign-outputs/components/generate-outputs-launcher";
import { OpenCampaignStudioLauncher } from "@/features/campaign-outputs/components/open-campaign-studio-launcher";
import { seedFromShortlist } from "@/features/campaign-outputs/hydration/seed-adapters";

export default async function ShortlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await getShortlistDetail(id);
  if (!detail) notFound();

  const [campaigns, brands, clients] = await Promise.all([
    getShortlistCampaignOptions(),
    getShortlistBrandOptions(),
    getShortlistClientOptions(),
  ]);

  return (
    <DiscoveryPageShell
      page="shortlists"
      activeHref={`/discovery/shortlists/${id}`}
      variant="workspace"
      showHeader={false}
      toolbar={
        <DiscoveryWorkspaceToolbar
          backHref="/discovery/shortlists"
          backLabel="← Back to shortlists"
          actions={
            <>
              <OpenCampaignStudioLauncher
                seed={seedFromShortlist(detail)}
                tab="studio"
                workspace={{ type: "shortlist", id: detail.id }}
                variant="primary"
              />
              <GenerateOutputsLauncher
                seed={seedFromShortlist(detail)}
                tab="outputs"
                workspace={{ type: "shortlist", id: detail.id }}
                className="w-full max-w-md sm:w-auto"
              />
            </>
          }
        />
      }
    >
      <div className={DISCOVERY_WORKSPACE_INNER_CLASS}>
        <ShortlistWorkspace
          detail={detail}
          campaigns={campaigns}
          brands={brands}
          clients={clients}
        />
      </div>
    </DiscoveryPageShell>
  );
}
```

#### `features/discovery/shortlists/components/shortlist-workspace.tsx`

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  FileTextIcon,
  GitCompareArrowsIcon,
  PencilIcon,
  SendIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { discoverySelectionFlyoutContentClass } from "@/features/discovery/components/design-system/discovery-selection-flyout";
import { cn } from "@/lib/utils";
import { stashCompareQueue } from "@/features/discovery/components/creator-search/creator-search-utils";
import { refreshCreatorsBatchAction } from "@/features/discovery/enrichment/actions";
import { pollCreatorsAfterBatchRefresh } from "@/features/discovery/enrichment/poll-creator-refresh";
import {
  isEnrichmentInProgress,
  resolveCreatorEnrichmentStatus,
  syncStatusToEnrichmentStatus,
  type CreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import type { ShortlistTemplateVariant } from "@/features/discovery/shortlists/export/shortlist-template";
import { buildShortlistExportHref } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import {
  addShortlistCreatorsToQuotation,
  createQuotationFromShortlist,
} from "@/features/quotations/actions";
import { quotationDetailPath } from "@/features/quotations/constants";
import { generateQuotationVersion } from "@/features/quotations/lifecycle-actions";
import { canGenerateQuotationVersion } from "@/lib/commercial-sync/rules";
import { MAX_CREATOR_COMPARE } from "@/lib/creators/creator-compare-bundle";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CreatorMovementAction } from "@/types/database";

import {
  bulkApproveCreators,
  bulkCancelCreators,
  bulkRejectCreators,
  bulkRemoveCreatorsFromShortlist,
  bulkSubmitCreatorsForReview,
  submitEntireShortlistForReview,
} from "../bulk-actions";
import {
  countSelected,
  filterEligibleForMove,
  filterSelectedItems,
  isAllVisibleSelected,
  isIndeterminateSelection,
  pruneSelection,
  toggleItemSelection,
  toggleSelectAll,
} from "../bulk-selection-policy";
import {
  approveShortlist,
  archiveShortlist,
  cancelShortlist,
  rejectShortlist,
  reopenShortlist,
  removeCreatorFromShortlistV2,
} from "../actions";
import { canEditCreators, canMoveToCampaign, isMovementLocked } from "../transitions";
import type {
  ShortlistBrandOption,
  ShortlistCampaignOption,
  ShortlistClientOption,
  ShortlistDetail,
} from "../types";
import { AddCreatorsDrawer } from "./add-creators-drawer";
import { GenerateQuotationShortlistDialog } from "./generate-quotation-shortlist-dialog";
import { MoveToCampaignDialog } from "./move-to-campaign-dialog";
import { ShortlistEditDialog } from "./shortlist-edit-dialog";
import {
  ShortlistQuotationActions,
  ShortlistQuotationPanel,
} from "./shortlist-quotation-panel";
import { ShortlistBulkToolbar } from "./shortlist-bulk-toolbar";
import { ShortlistCreatorToolbarActions } from "./shortlist-creator-toolbar-actions";
import {
  ShortlistCreatorEmptyState,
  ShortlistCreatorList,
} from "./shortlist-creator-list";
import { ShortlistMetricsRefreshBanner } from "./shortlist-metrics-refresh-banner";
import { SubmitShortlistDialog } from "./submit-shortlist-dialog";
import {
  AssignmentStatusBadge,
} from "./shortlist-badges";
import {
  ShortlistDetailCard,
  ShortlistHeaderPill,
  ShortlistToolbarButton,
} from "./shortlist-detail-primitives";
import {
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";

const MOVEMENT_LABELS: Record<CreatorMovementAction, string> = {
  discovery_to_shortlist: "Added from discovery",
  shortlist_to_campaign: "Moved to campaign",
  campaign_to_shortlist: "Returned from campaign",
  campaign_to_removed: "Removed from campaign",
  creator_added: "Creator added",
  creator_removed: "Creator removed",
  shortlist_submitted: "Submitted for review",
  shortlist_approved: "Approved",
  shortlist_rejected: "Returned to draft",
  shortlist_cancelled: "Cancelled",
  shortlist_reopened: "Reopened",
  shortlist_archived: "Archived",
};

export function ShortlistWorkspace({
  detail,
  campaigns,
  brands,
  clients,
}: {
  detail: ShortlistDetail;
  campaigns: ShortlistCampaignOption[];
  brands: ShortlistBrandOption[];
  clients: ShortlistClientOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [submitAllOpen, setSubmitAllOpen] = useState(false);
  const [quoteAllOpen, setQuoteAllOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [exportTemplate, setExportTemplate] = useState<ShortlistTemplateVariant>("showcase");
  const [enrichmentOverrides, setEnrichmentOverrides] = useState<
    Map<string, CreatorEnrichmentStatus>
  >(() => new Map());
  const [creatorPatches, setCreatorPatches] = useState<
    Map<string, UnifiedCreatorResult>
  >(() => new Map());
  const [refreshProgress, setRefreshProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
  } | null>(null);

  const refreshingMetrics = refreshProgress != null && refreshProgress.completed < refreshProgress.total;

  const editable = canEditCreators(detail.status) && !detail.is_archived;
  const canEditDetails = detail.canManage && !detail.is_archived && !isMovementLocked(detail.status);
  const movable = canMoveToCampaign(detail.status);
  const selectable = !detail.is_archived && detail.creators.length > 0;
  const linkedQuotations = detail.linkedQuotations;
  const hasLinkedQuotation = linkedQuotations.length > 0;
  const latestQuotation = linkedQuotations[0] ?? null;

  const visibleItemIds = useMemo(
    () => detail.creators.map((item) => item.item_id),
    [detail.creators]
  );

  const effectiveSelectedIds = useMemo(
    () => pruneSelection(selectedIds, visibleItemIds),
    [selectedIds, visibleItemIds]
  );

  const selectedCount = countSelected(effectiveSelectedIds);
  const allSelected = isAllVisibleSelected(visibleItemIds, effectiveSelectedIds);
  const indeterminate = isIndeterminateSelection(visibleItemIds, effectiveSelectedIds);

  const selectedItems = useMemo(
    () => filterSelectedItems(detail.creators, effectiveSelectedIds),
    [detail.creators, effectiveSelectedIds]
  );

  const selectedItemIdList = useMemo(
    () => selectedItems.map((item) => item.item_id),
    [selectedItems]
  );

  const existingItems = useMemo(
    () =>
      detail.creators.map((item) => ({
        unified_id: item.unified_id,
        profile_id: item.profile_id,
        influencer_id: item.influencer_id,
      })),
    [detail.creators]
  );

  const patchCreatorInList = useCallback((next: UnifiedCreatorResult) => {
    setCreatorPatches((prev) => {
      const map = new Map(prev);
      map.set(next.unified_id, next);
      return map;
    });
  }, []);

  useEffect(() => {
    setCreatorPatches((prev) => (prev.size === 0 ? prev : new Map()));

    setEnrichmentOverrides((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const item of detail.creators) {
        const unifiedId = item.unified_id ?? item.creator?.unified_id ?? null;
        if (!unifiedId || !next.has(unifiedId)) continue;
        const override = next.get(unifiedId)!;
        const serverStatus = resolveCreatorEnrichmentStatus(item.creator?.enrichment_status);
        if (
          !isEnrichmentInProgress(override) &&
          !isEnrichmentInProgress(serverStatus)
        ) {
          next.delete(unifiedId);
        }
      }
      return next;
    });
  }, [detail.creators]);

  const displayCreators = useMemo(
    () =>
      detail.creators.map((item) => {
        if (!item.creator) return item;
        const unifiedId = item.unified_id ?? item.creator.unified_id ?? null;
        if (!unifiedId) return item;
        const patch = creatorPatches.get(unifiedId);
        const override = enrichmentOverrides.get(unifiedId);
        let creator = patch ?? item.creator;
        if (override) {
          creator = { ...creator, enrichment_status: override };
        }
        if (creator === item.creator && !override) return item;
        return { ...item, creator };
      }),
    [detail.creators, creatorPatches, enrichmentOverrides]
  );

  function selectedCreators(): UnifiedCreatorResult[] {
    return selectedItems
      .filter((item) => item.creator)
      .map((item) => item.creator as UnifiedCreatorResult);
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleCompare() {
    const pool =
      selectedCount > 0
        ? selectedCreators()
        : detail.creators.filter((i) => i.creator).map((i) => i.creator!);
    if (pool.length < 2) {
      toast.error("Select at least 2 creators with resolved profiles to compare.");
      return;
    }
    stashCompareQueue(pool.slice(0, MAX_CREATOR_COMPARE));
    router.push("/discovery/compare");
  }

  function handleExportSelected() {
    const itemIds = selectedCount > 0 ? selectedItemIdList : undefined;
    const href = buildShortlistExportHref(detail.id, "csv", exportTemplate, { itemIds });
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function handleRefreshMetrics() {
    const pool =
      selectedCount > 0
        ? selectedItems.filter((item) => {
            const unifiedId = item.unified_id ?? item.creator?.unified_id;
            return unifiedId && item.influencer_id;
          })
        : detail.creators.filter((item) => {
            const unifiedId = item.unified_id ?? item.creator?.unified_id;
            return unifiedId && item.influencer_id;
          });

    if (pool.length === 0) {
      toast.error("No creators with linked vendor profiles to refresh.");
      return;
    }

    const targets = pool.map((item) => ({
      unifiedId: (item.unified_id ?? item.creator!.unified_id)!,
      influencerId: item.influencer_id!,
    }));
    const unifiedIds = targets.map((target) => target.unifiedId);

    setRefreshProgress({ total: targets.length, completed: 0, failed: 0 });
    setEnrichmentOverrides((prev) => {
      const next = new Map(prev);
      for (const target of targets) {
        next.set(target.unifiedId, "queued");
      }
      return next;
    });

    let failedCount = 0;

    startTransition(async () => {
      try {
        const result = await refreshCreatorsBatchAction(unifiedIds);
        if (!result.queued) {
          setRefreshProgress(null);
          setEnrichmentOverrides(new Map());
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        void pollCreatorsAfterBatchRefresh(targets, {
          onUpdated: patchCreatorInList,
          onStatusChange: ({ unifiedId, status }) => {
            setEnrichmentOverrides((prev) => {
              const next = new Map(prev);
              next.set(unifiedId, syncStatusToEnrichmentStatus(status));
              return next;
            });
          },
          onComplete: ({ status }) => {
            if (status === "failed") failedCount += 1;
            setRefreshProgress((prev) =>
              prev
                ? {
                    ...prev,
                    completed: prev.completed + 1,
                    failed: prev.failed + (status === "failed" ? 1 : 0),
                  }
                : null
            );
          },
        }).finally(() => {
          if (failedCount > 0) {
            toast.error(
              failedCount === targets.length
                ? "Creator refresh failed"
                : `${failedCount} of ${targets.length} creator refreshes failed`
            );
          } else {
            toast.success("Creator metrics updated");
          }
          window.setTimeout(() => {
            setRefreshProgress(null);
          }, 1200);
          router.refresh();
        });
      } catch (error) {
        setRefreshProgress(null);
        setEnrichmentOverrides(new Map());
        toast.error(error instanceof Error ? error.message : "Refresh failed");
      }
    });
  }

  const runQuotation = useCallback(
    (itemIds?: string[]) => {
      startTransition(async () => {
        const res = itemIds?.length
          ? await createQuotationFromShortlist(detail.id, { itemIds })
          : await createQuotationFromShortlist(detail.id);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message ?? "Quotation created.");
        if (res.data?.id) router.push(quotationDetailPath(res.data.id));
      });
    },
    [detail.id, router]
  );

  function handleGenerateQuotation() {
    if (detail.creators.length === 0) {
      toast.error("Add creators to this shortlist first.");
      return;
    }
    if (selectedCount > 0) {
      runQuotation(selectedItemIdList);
      return;
    }
    setQuoteAllOpen(true);
  }

  function handleGenerateNewVersion() {
    if (!latestQuotation) {
      handleGenerateQuotation();
      return;
    }
    if (canGenerateQuotationVersion(latestQuotation.status)) {
      startTransition(async () => {
        const res = await generateQuotationVersion({ quotationId: latestQuotation.id });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message ?? "New version created.");
        if (res.data?.newQuotationId) {
          router.push(quotationDetailPath(res.data.newQuotationId));
        } else {
          router.refresh();
        }
      });
      return;
    }
    handleGenerateQuotation();
  }

  function handleAddToQuotation(itemId: string) {
    startTransition(async () => {
      try {
        const res = await addShortlistCreatorsToQuotation({
          shortlistId: detail.id,
          itemIds: [itemId],
        });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message ?? "Added to quotation.");
        if (res.data?.quotationId) {
          router.push(quotationDetailPath(res.data.quotationId));
        } else {
          router.refresh();
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to add creator to quotation."
        );
      }
    });
  }

  function handleSubmitForReview() {
    if (selectedCount > 0) {
      runAction(async () =>
        bulkSubmitCreatorsForReview(detail.id, selectedItemIdList)
      );
      return;
    }
    setSubmitAllOpen(true);
  }

  function handleSubmitEntireShortlist() {
    runAction(async () => {
      const result = await submitEntireShortlistForReview(detail.id);
      if (result.ok) {
        setSubmitAllOpen(false);
        clearSelection();
      }
      return result;
    });
  }

  function handleBulkRemove() {
    runAction(async () => {
      const result = await bulkRemoveCreatorsFromShortlist(detail.id, selectedItemIdList);
      if (result.ok) clearSelection();
      return result;
    });
  }

  function handleBulkMove() {
    const eligible = filterEligibleForMove(selectedItems);
    if (eligible.length === 0) {
      toast.error("Selected creators must be approved before moving to a campaign.");
      return;
    }
    setMoveOpen(true);
  }

  function handleBulkApprove() {
    runAction(() => bulkApproveCreators(detail.id, selectedItemIdList));
  }

  function handleBulkReject() {
    runAction(() => bulkRejectCreators(detail.id, selectedItemIdList));
  }

  function handleBulkCancel() {
    runAction(() => bulkCancelCreators(detail.id, selectedItemIdList));
  }

  function runAction(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message ?? "Done");
          router.refresh();
        } else {
          toast.error(result.message ?? "Action failed");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    });
  }

  function handleToggleSelectAll() {
    setSelectedIds(toggleSelectAll(visibleItemIds, effectiveSelectedIds, !allSelected));
  }

  return (
    <div className="space-y-4">
      <ShortlistDetailCard className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {detail.serial_number ?? "—"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              {detail.name}
            </h1>
            {canEditDetails ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                disabled={isPending}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-slate-300 hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                aria-label="Edit shortlist"
              >
                <PencilIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
          {detail.description ? (
            <p className="text-sm text-muted-foreground">{detail.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <ShortlistHeaderPill>{SHORTLIST_STATUS_LABELS[detail.status]}</ShortlistHeaderPill>
            <ShortlistHeaderPill>
              {SHORTLIST_VISIBILITY_LABELS[detail.visibility]}
            </ShortlistHeaderPill>
            <ShortlistHeaderPill>
              Owner:{" "}
              <strong className="ml-0.5 font-medium text-foreground">
                {detail.owner_name ?? "—"}
              </strong>
            </ShortlistHeaderPill>
            {detail.client_name ? (
              <ShortlistHeaderPill>Legal entity: {detail.client_name}</ShortlistHeaderPill>
            ) : null}
            {detail.brand_name ? (
              <ShortlistHeaderPill>Brand: {detail.brand_name}</ShortlistHeaderPill>
            ) : null}
          </div>
          {detail.status === "approved" && detail.approved_by_name ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Approved by {detail.approved_by_name}
              {detail.approved_at
                ? ` · ${format(new Date(detail.approved_at), "MMM d, yyyy")}`
                : ""}
            </p>
          ) : null}
          {detail.status === "cancelled" && detail.cancellation_reason ? (
            <p className="text-xs text-destructive">
              Cancelled: {detail.cancellation_reason}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 pt-0.5">
          {detail.status === "draft" ? (
            <ShortlistToolbarButton
              variant="primary"
              onClick={handleSubmitForReview}
              disabled={isPending || detail.creators.length === 0}
            >
              <SendIcon className="size-3.5" />
              Submit for review
            </ShortlistToolbarButton>
          ) : null}
          {detail.status === "under_review" && detail.canApprove ? (
            <>
              <ShortlistToolbarButton
                variant="primary"
                onClick={() => runAction(() => approveShortlist(detail.id))}
                disabled={isPending}
              >
                Approve
              </ShortlistToolbarButton>
              <ShortlistToolbarButton
                onClick={() => runAction(() => rejectShortlist(detail.id))}
                disabled={isPending}
              >
                Return to draft
              </ShortlistToolbarButton>
            </>
          ) : null}
          {detail.status === "approved" && selectedCount > 0 ? (
            <ShortlistToolbarButton onClick={handleBulkMove} disabled={isPending}>
              Move to campaign ({selectedCount})
            </ShortlistToolbarButton>
          ) : null}
          {detail.status === "cancelled" ? (
            <ShortlistToolbarButton
              onClick={() => runAction(() => reopenShortlist(detail.id))}
              disabled={isPending}
            >
              Reopen
            </ShortlistToolbarButton>
          ) : null}
          {detail.status !== "archived" && detail.status !== "cancelled" ? (
            <ShortlistToolbarButton
              onClick={() => runAction(() => cancelShortlist(detail.id))}
              disabled={isPending}
            >
              Cancel
            </ShortlistToolbarButton>
          ) : null}
          {detail.status !== "archived" ? (
            <ShortlistToolbarButton
              variant="danger"
              onClick={() => runAction(() => archiveShortlist(detail.id))}
              disabled={isPending}
            >
              Archive
            </ShortlistToolbarButton>
          ) : null}
        </div>

        {hasLinkedQuotation ? (
          <div className="w-full border-t border-border pt-4">
            <ShortlistQuotationPanel
              quotations={linkedQuotations}
              onGenerateNewVersion={handleGenerateNewVersion}
              busy={isPending}
            />
          </div>
        ) : null}
      </ShortlistDetailCard>

      <ShortlistDetailCard padding="none" className={cn(discoverySelectionFlyoutContentClass(selectedCount > 0), "overflow-hidden")}>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-bold text-foreground">
                Creators{" "}
                <span className="font-normal text-muted-foreground">
                  ({detail.creators.length})
                </span>
              </p>
              <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
                Discovery-style creator rows with review status. Select creators for bulk
                actions.
              </p>
            </div>

            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            {detail.creators.length > 0 ? (
              <>
                {hasLinkedQuotation ? (
                  <ShortlistQuotationActions
                    quotations={linkedQuotations}
                    onGenerateNewVersion={handleGenerateNewVersion}
                    busy={isPending}
                  />
                ) : (
                  <ShortlistToolbarButton
                    onClick={handleGenerateQuotation}
                    disabled={isPending}
                  >
                    <FileTextIcon className="size-3.5" />
                    Generate quotation
                  </ShortlistToolbarButton>
                )}
                <ShortlistToolbarButton onClick={handleCompare} disabled={isPending}>
                  <GitCompareArrowsIcon className="size-3.5" />
                  Compare
                </ShortlistToolbarButton>
                <ShortlistCreatorToolbarActions
                  shortlistId={detail.id}
                  exportTemplate={exportTemplate}
                  onExportTemplateChange={setExportTemplate}
                  selectedItemIds={selectedItemIdList}
                  exportRevision={detail.updated_at}
                  busy={isPending || refreshingMetrics}
                  onRefreshMetrics={handleRefreshMetrics}
                />
              </>
            ) : null}
            {editable ? (
              <ShortlistToolbarButton
                variant="primary"
                onClick={() => setAddOpen(true)}
                disabled={isPending}
              >
                <UserPlusIcon className="size-3.5" />
                Add creators
              </ShortlistToolbarButton>
            ) : null}
            </div>
          </div>
        </div>

        {refreshProgress ? (
          <ShortlistMetricsRefreshBanner
            total={refreshProgress.total}
            completed={refreshProgress.completed}
            failed={refreshProgress.failed}
          />
        ) : null}

        {detail.creators.length === 0 ? (
          <ShortlistCreatorEmptyState
            editable={editable}
            onAddCreators={() => setAddOpen(true)}
          />
        ) : (
          <ShortlistCreatorList
            items={displayCreators}
            selectedIds={effectiveSelectedIds}
            selectable={selectable}
            allSelected={allSelected}
            indeterminate={indeterminate}
            editable={editable}
            busy={isPending}
            onToggleSelect={(itemId) =>
              setSelectedIds(
                toggleItemSelection(
                  effectiveSelectedIds,
                  itemId,
                  !effectiveSelectedIds.has(itemId)
                )
              )
            }
            onToggleSelectAll={handleToggleSelectAll}
            onRemove={(itemId) =>
              runAction(() => removeCreatorFromShortlistV2(detail.id, itemId))
            }
            onAddToQuotation={handleAddToQuotation}
            onCreatorDeleted={() => router.refresh()}
          />
        )}
      </ShortlistDetailCard>

      {detail.movedAssignments.length > 0 ? (
        <ShortlistDetailCard>
          <h2 className="text-sm font-bold text-foreground">Moved to campaigns</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Creators moved from this shortlist and their current assignment status.
          </p>
          <div className="mt-4 space-y-2">
            {detail.movedAssignments.map((assignment) => (
              <div
                key={assignment.assignment_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {assignment.influencer_name ?? "Creator"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {assignment.campaign_document_number ??
                      assignment.campaign_name ??
                      assignment.campaign_header_id}
                  </p>
                </div>
                <AssignmentStatusBadge status={assignment.assignment_status} />
              </div>
            ))}
          </div>
        </ShortlistDetailCard>
      ) : null}

      <ShortlistDetailCard>
        <h2 className="text-sm font-bold text-foreground">Movement history</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Audit trail of every creator movement.
        </p>
        {detail.movements.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No movements recorded yet.
          </p>
        ) : (
          <div className="mt-4">
            {detail.movements.map((movement, index) => (
              <div
                key={movement.id}
                className={cn(
                  "relative flex gap-3 py-2.5",
                  index < detail.movements.length - 1 && "border-b border-border"
                )}
              >
                {index < detail.movements.length - 1 ? (
                  <span
                    className="absolute left-[7px] top-[26px] bottom-[-10px] w-px bg-border"
                    aria-hidden
                  />
                ) : null}
                <span
                  className="relative z-[1] mt-0.5 size-[15px] shrink-0 rounded-full border-2 border-primary bg-primary/10 shadow-[0_0_0_3px_rgba(0,87,255,0.1)]"
                  aria-hidden
                />
                <div className="min-w-0 pb-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {MOVEMENT_LABELS[movement.action]}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {movement.performed_by_name ? (
                      <span className="font-medium text-primary">
                        {movement.performed_by_name}
                      </span>
                    ) : (
                      "System"
                    )}
                    {" · "}
                    {format(new Date(movement.performed_at), "MMM d, yyyy HH:mm")}
                    {movement.notes ? ` · ${movement.notes}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ShortlistDetailCard>

      <ShortlistEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        detail={detail}
        clients={clients}
        brands={brands}
      />

      <MoveToCampaignDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        shortlistId={detail.id}
        shortlistName={detail.name}
        selectedItemIds={
          selectedItemIdList.length > 0
            ? filterEligibleForMove(selectedItems).map((item) => item.item_id)
            : []
        }
        campaigns={campaigns}
        brands={brands}
      />

      <SubmitShortlistDialog
        open={submitAllOpen}
        onOpenChange={setSubmitAllOpen}
        creatorCount={detail.creators.length}
        onConfirm={handleSubmitEntireShortlist}
        busy={isPending}
      />

      <GenerateQuotationShortlistDialog
        open={quoteAllOpen}
        onOpenChange={setQuoteAllOpen}
        creatorCount={detail.creators.length}
        shortlistName={detail.name}
        onConfirm={() => {
          setQuoteAllOpen(false);
          runQuotation();
        }}
        busy={isPending}
      />

      <AddCreatorsDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        shortlistId={detail.id}
        existingItems={existingItems}
        onAdded={() => router.refresh()}
      />

      <ShortlistBulkToolbar
        selectedCount={selectedCount}
        showSubmit={editable}
        showStatusActions={detail.status === "under_review" && detail.canApprove}
        showMove={movable}
        busy={isPending || refreshingMetrics}
        onSubmitSelected={() =>
          runAction(() => bulkSubmitCreatorsForReview(detail.id, selectedItemIdList))
        }
        onRemoveSelected={handleBulkRemove}
        onCompareSelected={handleCompare}
        onRefreshMetrics={handleRefreshMetrics}
        onExportSelected={handleExportSelected}
        onMoveSelected={handleBulkMove}
        onGenerateQuotation={handleGenerateQuotation}
        onApproveSelected={handleBulkApprove}
        onRejectSelected={handleBulkReject}
        onCancelSelected={handleBulkCancel}
        onClearSelection={clearSelection}
      />
    </div>
  );
}
```

#### `features/discovery/shortlists/components/shortlist-detail-primitives.tsx`

```tsx
"use client";

import { CheckIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ShortlistDetailCheckbox({
  checked,
  indeterminate,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  className?: string;
  "aria-label"?: string;
}) {
  const showCheck = checked || indeterminate;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border-[1.5px] border-border bg-background transition-colors",
        showCheck && "border-primary bg-primary",
        className
      )}
    >
      {indeterminate && !checked ? (
        <span className="h-0.5 w-2 rounded-full bg-white" aria-hidden />
      ) : (
        <CheckIcon
          className={cn("size-2.5 text-white", checked ? "opacity-100" : "opacity-0")}
          strokeWidth={3}
        />
      )}
    </button>
  );
}

export function ShortlistHeaderPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full border border-border bg-muted/60 px-2.5 text-[11px] font-semibold text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

export function ShortlistDetailCard({
  children,
  className,
  padding = "default",
}: {
  children: ReactNode;
  className?: string;
  padding?: "default" | "none";
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--tw-border)] bg-background shadow-sm",
        padding === "default" && "p-[22px] px-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ShortlistToolbarButton({
  children,
  className,
  variant = "outline",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "outline" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-[34px] items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-all active:scale-[0.97]",
        variant === "outline" &&
          "border border-border bg-background text-muted-foreground hover:border-slate-300 hover:bg-muted/50",
        variant === "primary" &&
          "border-0 bg-primary text-primary-foreground shadow-[0_2px_10px_rgba(0,87,255,0.28)] hover:-translate-y-px hover:shadow-[0_4px_18px_rgba(0,87,255,0.35)]",
        variant === "danger" &&
          "border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100",
        props.disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

#### `features/discovery/shortlists/components/shortlist-creator-list.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  brandSafetyMeta,
} from "@/features/discovery/components/creator-search/creator-search-utils";
import {
  DiscoveryCreatorExactHeader,
  DiscoveryCreatorExactRow,
} from "@/features/discovery/components/discovery-creator-exact-row";
import { EnrichmentStatusBadge } from "@/features/discovery/enrichment/components/enrichment-status-badge";
import { DeleteDiscoveryCreatorDialog } from "@/features/discovery/delete-creator/delete-discovery-creator-dialog";
import {
  isEnrichmentInProgress,
  resolveEnrichmentDisplayStatus,
} from "@/features/discovery/enrichment/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ShortlistCreatorQuotationRef } from "../types";
import type { ShortlistItemStatus } from "@/types/database";
import { ArrowDownIcon, ArrowUpIcon, MoreHorizontalIcon, UsersIcon } from "lucide-react";

import { ShortlistItemStatusBadge, ShortlistCreatorQuotedBadge } from "./shortlist-badges";
import { SHORTLIST_QUOTED_COLUMN_LABEL } from "../constants";
import {
  applyShortlistHeaderSort,
  sortShortlistCreators,
  type ShortlistCreatorSortField,
  type ShortlistCreatorSortState,
} from "../shortlist-creator-sort";

type ShortlistRowItem = {
  item_id: string;
  item_status: ShortlistItemStatus;
  creator: UnifiedCreatorResult | null;
  quotation_refs: ShortlistCreatorQuotationRef[];
};

type Props = {
  items: ShortlistRowItem[];
  selectedIds: Set<string>;
  selectable: boolean;
  allSelected: boolean;
  indeterminate: boolean;
  editable: boolean;
  busy?: boolean;
  onToggleSelect: (itemId: string) => void;
  onToggleSelectAll: () => void;
  onRemove: (itemId: string) => void;
  onAddToQuotation: (itemId: string) => void;
  onCreatorDeleted?: () => void;
  onOpenCreator?: (creator: UnifiedCreatorResult) => void;
};

function SortableMetaLabel({
  label,
  field,
  sort,
  onSortChange,
}: {
  label: string;
  field: ShortlistCreatorSortField;
  sort: ShortlistCreatorSortState | null;
  onSortChange: (next: ShortlistCreatorSortState) => void;
}) {
  const isActive = sort?.field === field;

  return (
    <button
      type="button"
      onClick={() => onSortChange(applyShortlistHeaderSort(sort, field))}
      aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "inline-flex min-w-0 items-center gap-0.5 transition-colors hover:text-foreground",
        isActive && "text-foreground"
      )}
    >
      <span className="truncate">{label}</span>
      {isActive ? (
        sort.direction === "asc" ? (
          <ArrowUpIcon className="size-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDownIcon className="size-3 shrink-0" aria-hidden />
        )
      ) : null}
    </button>
  );
}

function RowActions({
  editable,
  busy,
  visible,
  onAddToQuotation,
  onRemove,
  onDeleteCreator,
}: {
  editable: boolean;
  busy?: boolean;
  visible?: boolean;
  onAddToQuotation: () => void;
  onRemove: () => void;
  onDeleteCreator?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="discovery-search-exact-row-menu size-9 shrink-0 text-muted-foreground"
          disabled={busy}
          aria-label="Creator actions"
        >
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={onAddToQuotation} disabled={busy}>
          Add to quotation
        </DropdownMenuItem>
        {onDeleteCreator ? (
          <DropdownMenuItem
            onSelect={onDeleteCreator}
            disabled={busy}
            className="text-red-600 focus:text-red-600"
          >
            Delete creator
          </DropdownMenuItem>
        ) : null}
        {editable ? (
          <>
            {onDeleteCreator ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              onSelect={onRemove}
              disabled={busy}
              className="text-red-600 focus:text-red-600"
            >
              Remove from shortlist
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreatorDataRow({
  item,
  selected,
  selectable,
  editable,
  busy,
  onToggleSelect,
  onRemove,
  onAddToQuotation,
  onCreatorDeleted,
  onOpenCreator,
}: {
  item: ShortlistRowItem;
  selected: boolean;
  selectable: boolean;
  editable: boolean;
  busy?: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onAddToQuotation: () => void;
  onCreatorDeleted?: () => void;
  onOpenCreator?: (creator: UnifiedCreatorResult) => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const creator = item.creator!;
  const safety = brandSafetyMeta(creator.authenticity_score);
  const enrichmentStatus = resolveEnrichmentDisplayStatus(
    creator.enrichment_status,
    creator
  );
  const enriching = isEnrichmentInProgress(enrichmentStatus);

  return (
    <>
      <DiscoveryCreatorExactRow
        creator={creator}
        selected={selected}
        selectable={selectable}
        enriching={enriching}
        onToggleSelect={onToggleSelect}
        onOpenCreator={() => onOpenCreator?.(creator)}
        rowBehavior="toggle-select"
        meta={
          <>
            <span
              className={cn("text-[11px] font-medium", safety.className)}
              title={safety.label}
            >
              {safety.label}
            </span>
            <EnrichmentStatusBadge status={enrichmentStatus} className="text-[10px]" />
            <ShortlistItemStatusBadge status={item.item_status} variant="table" />
            <ShortlistCreatorQuotedBadge refs={item.quotation_refs} variant="table" />
          </>
        }
        actions={
          <RowActions
            editable={editable}
            busy={busy}
            visible={selected}
            onAddToQuotation={onAddToQuotation}
            onRemove={onRemove}
            onDeleteCreator={
              creator.influencer_id ? () => setDeleteOpen(true) : undefined
            }
          />
        }
      />
      {creator.influencer_id ? (
        <DeleteDiscoveryCreatorDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          creator={creator}
          onDeleted={onCreatorDeleted}
        />
      ) : null}
    </>
  );
}

function UnknownCreatorRow({
  item,
  selected,
  selectable,
  editable,
  busy,
  onToggleSelect,
  onRemove,
  onAddToQuotation,
}: {
  item: ShortlistRowItem;
  selected: boolean;
  selectable: boolean;
  editable: boolean;
  busy?: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onAddToQuotation: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => selectable && onToggleSelect()}
      onKeyDown={(event) => {
        if (!selectable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleSelect();
        }
      }}
      className={cn(
        "discovery-search-exact-row discovery-search-exact-row--with-meta",
        selected && "is-selected"
      )}
    >
      <div className="discovery-search-exact-photo-cell">
        {selectable ? (
          <span className="discovery-search-exact-select">
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              aria-label="Select unknown creator"
            />
          </span>
        ) : null}
        <div className="discovery-search-exact-photo-wrap flex size-[87px] items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground">
          ?
        </div>
      </div>
      <div className="discovery-search-exact-info-cell">
        <div className="discovery-search-exact-info-stack">
          <div className="discovery-search-exact-name">Unknown creator</div>
          <div className="discovery-search-exact-handle">Profile not resolved</div>
        </div>
      </div>
      <div className="discovery-search-exact-category-cell">
        <span className="text-[11px] text-muted-foreground/60">—</span>
      </div>
      <div className="discovery-search-exact-stat-box opacity-40">
        <span className="text-[11px] text-muted-foreground">No metrics</span>
      </div>
      <div className="discovery-search-exact-feed-thumbs discovery-search-exact-feed-thumbs--empty" />
      <div className="discovery-search-exact-meta-cell">
        <ShortlistItemStatusBadge status={item.item_status} variant="table" />
        <ShortlistCreatorQuotedBadge refs={item.quotation_refs} variant="table" />
      </div>
      <div className="discovery-search-exact-actions">
        <RowActions
          editable={editable}
          busy={busy}
          visible={selected}
          onAddToQuotation={onAddToQuotation}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

export function ShortlistCreatorList({
  items,
  selectedIds,
  selectable,
  allSelected,
  indeterminate,
  editable,
  busy,
  onToggleSelect,
  onToggleSelectAll,
  onRemove,
  onAddToQuotation,
  onCreatorDeleted,
  onOpenCreator,
}: Props) {
  const [sort, setSort] = useState<ShortlistCreatorSortState | null>(null);
  const sortedItems = useMemo(() => sortShortlistCreators(items, sort), [items, sort]);

  return (
    <div className="discovery-search-exact-root">
      <DiscoveryCreatorExactHeader
        total={sortedItems.length}
        allSelected={indeterminate ? "indeterminate" : allSelected}
        hasCreators={sortedItems.length > 0}
        onToggleSelectAll={onToggleSelectAll}
        showSelectAll={selectable}
        metaLabel={
          <span className="flex flex-wrap items-center gap-3">
            <SortableMetaLabel
              label="Safety"
              field="brand_safety"
              sort={sort}
              onSortChange={setSort}
            />
            <SortableMetaLabel label="Sync" field="sync" sort={sort} onSortChange={setSort} />
            <SortableMetaLabel label="Status" field="status" sort={sort} onSortChange={setSort} />
            <SortableMetaLabel
              label={SHORTLIST_QUOTED_COLUMN_LABEL}
              field="quoted"
              sort={sort}
              onSortChange={setSort}
            />
          </span>
        }
      />
      <div className="discovery-search-exact-scroll max-h-[min(70vh,960px)] overscroll-y-auto">
        {sortedItems.map((item) => {
          const isSelected = selectedIds.has(item.item_id);
          const common = {
            item,
            selected: isSelected,
            selectable,
            editable,
            busy,
            onToggleSelect: () => onToggleSelect(item.item_id),
            onRemove: () => onRemove(item.item_id),
            onAddToQuotation: () => onAddToQuotation(item.item_id),
            onCreatorDeleted,
            onOpenCreator,
          };

          if (!item.creator) {
            return <UnknownCreatorRow key={item.item_id} {...common} />;
          }

          return <CreatorDataRow key={item.item_id} {...common} />;
        })}
      </div>
    </div>
  );
}

export function ShortlistCreatorEmptyState({
  editable,
  onAddCreators,
}: {
  editable: boolean;
  onAddCreators: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
      <div className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-muted/50">
        <UsersIcon className="size-[18px] text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-semibold text-foreground">No creators yet</p>
      <p className="max-w-[280px] text-[11px] leading-relaxed text-muted-foreground">
        {editable
          ? "Click “Add creators” to search and build this shortlist."
          : "This shortlist is locked in its current status."}
      </p>
      {editable ? (
        <button
          type="button"
          onClick={onAddCreators}
          className="mt-1 inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm"
        >
          Add creators
        </button>
      ) : null}
    </div>
  );
}
```

#### `features/discovery/shortlists/components/shortlist-bulk-toolbar.tsx`

```tsx
"use client";

import {
  CheckIcon,
  DownloadIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo } from "react";

import {
  DiscoverySelectionFlyout,
  type DiscoverySelectionFlyoutAction,
} from "@/features/discovery/components/design-system";

type Props = {
  selectedCount: number;
  showSubmit: boolean;
  showStatusActions: boolean;
  showMove: boolean;
  busy?: boolean;
  onSubmitSelected: () => void;
  onRemoveSelected: () => void;
  onCompareSelected: () => void;
  onExportSelected: () => void;
  onRefreshMetrics?: () => void;
  onMoveSelected: () => void;
  onGenerateQuotation: () => void;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onCancelSelected: () => void;
  onClearSelection: () => void;
};

export function ShortlistBulkToolbar({
  selectedCount,
  showSubmit,
  showStatusActions,
  showMove,
  busy,
  onSubmitSelected,
  onRemoveSelected,
  onCompareSelected,
  onExportSelected,
  onRefreshMetrics,
  onMoveSelected,
  onGenerateQuotation,
  onApproveSelected,
  onRejectSelected,
  onCancelSelected,
  onClearSelection,
}: Props) {
  const actions = useMemo(() => {
    const list: DiscoverySelectionFlyoutAction[] = [];

    if (showSubmit) {
      list.push({
        id: "submit",
        label: "Submit selected",
        icon: SendIcon,
        variant: "primary",
        disabled: busy,
        onClick: onSubmitSelected,
      });
    }

    if (showStatusActions) {
      list.push(
        {
          id: "approve",
          label: "Approve",
          icon: CheckIcon,
          variant: "primary",
          disabled: busy,
          onClick: onApproveSelected,
        },
        {
          id: "reject",
          label: "Reject",
          variant: "outline",
          disabled: busy,
          onClick: onRejectSelected,
        }
      );
    }

    list.push(
      {
        id: "remove",
        label: "Remove",
        icon: Trash2Icon,
        variant: "outline",
        destructive: true,
        disabled: busy,
        onClick: onRemoveSelected,
      },
      {
        id: "compare",
        label: "Compare",
        icon: GitCompareArrowsIcon,
        variant: "outline",
        disabled: busy,
        onClick: onCompareSelected,
      },
      {
        id: "refresh-metrics",
        label: "Refresh metrics",
        icon: RefreshCwIcon,
        variant: "outline",
        disabled: busy || !onRefreshMetrics,
        onClick: () => onRefreshMetrics?.(),
      },
      {
        id: "export",
        label: "Export CSV",
        icon: DownloadIcon,
        variant: "outline",
        disabled: busy,
        onClick: onExportSelected,
      }
    );

    if (showMove) {
      list.push({
        id: "move",
        label: "Move to campaign",
        variant: "outline",
        disabled: busy,
        onClick: onMoveSelected,
      });
    }

    list.push(
      {
        id: "quotation",
        label: "Generate quotation",
        icon: FileTextIcon,
        variant: "outline",
        disabled: busy,
        onClick: onGenerateQuotation,
      },
      {
        id: "cancel",
        label: "Cancel selected",
        variant: "outline",
        disabled: busy,
        onClick: onCancelSelected,
      }
    );

    return list;
  }, [
    showSubmit,
    showStatusActions,
    showMove,
    busy,
    onSubmitSelected,
    onRemoveSelected,
    onCompareSelected,
    onExportSelected,
    onRefreshMetrics,
    onMoveSelected,
    onGenerateQuotation,
    onApproveSelected,
    onRejectSelected,
    onCancelSelected,
  ]);

  return (
    <DiscoverySelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="creator"
      actions={actions}
      onClearSelection={onClearSelection}
      busy={busy}
      maxVisibleActions={3}
    />
  );
}
```

#### `features/discovery/shortlists/components/shortlist-creator-toolbar-actions.tsx`

```tsx
"use client";

import Link from "next/link";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PresentationIcon,
  RefreshCwIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buildShortlistExportHref } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import { shortlistPreviewPath } from "@/features/discovery/shortlists/constants";
import {
  SHORTLIST_TEMPLATE_OPTIONS,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";
import { ShortlistToolbarButton } from "./shortlist-detail-primitives";

type Props = {
  shortlistId: string;
  exportTemplate: ShortlistTemplateVariant;
  onExportTemplateChange: (template: ShortlistTemplateVariant) => void;
  selectedItemIds: string[];
  exportRevision?: string | null;
  busy?: boolean;
  onRefreshMetrics: () => void;
};

const EXPORT_FORMATS = [
  { format: "html" as const, label: "HTML", icon: FileTextIcon },
  { format: "pdf" as const, label: "PDF", icon: DownloadIcon },
  { format: "excel" as const, label: "Excel", icon: FileSpreadsheetIcon },
  { format: "pptx" as const, label: "PPTX", icon: PresentationIcon, showcaseOnly: true },
  { format: "csv" as const, label: "CSV", icon: DownloadIcon },
  { format: "word" as const, label: "Word", icon: FileTextIcon },
];

export function ShortlistCreatorToolbarActions({
  shortlistId,
  exportTemplate,
  onExportTemplateChange,
  selectedItemIds,
  exportRevision,
  busy,
  onRefreshMetrics,
}: Props) {
  const itemIds = selectedItemIds.length > 0 ? selectedItemIds : undefined;
  const previewHref = shortlistPreviewPath(shortlistId, {
    template: exportTemplate,
    itemIds,
  });
  const exportOptions = { itemIds, exportRevision };

  return (
    <>
      <ShortlistToolbarButton onClick={onRefreshMetrics} disabled={busy}>
        <RefreshCwIcon className={cn("size-3.5", busy && "animate-spin")} />
        {busy ? "Collecting metrics" : "Refresh metrics"}
      </ShortlistToolbarButton>

      <div
        className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
        role="tablist"
        aria-label="Export template"
      >
        {SHORTLIST_TEMPLATE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={exportTemplate === option.id}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              exportTemplate === option.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onExportTemplateChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Link
        href={previewHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-xs font-semibold text-muted-foreground transition-all hover:border-slate-300 hover:bg-muted/50 active:scale-[0.97]"
      >
        <FileTextIcon className="size-3.5" />
        Preview
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-xs font-semibold text-muted-foreground transition-all hover:border-slate-300 hover:bg-muted/50 active:scale-[0.97]"
          >
            <DownloadIcon className="size-3.5" />
            Export
            <ChevronDownIcon className="size-3.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {EXPORT_FORMATS.filter(
            (entry) => !entry.showcaseOnly || exportTemplate === "showcase"
          ).map(({ format, label, icon: Icon }) => (
            <DropdownMenuItem key={format} asChild>
              <a
                href={buildShortlistExportHref(shortlistId, format, exportTemplate, exportOptions)}
                className="flex cursor-pointer items-center gap-2"
              >
                <Icon className="size-3.5" />
                {label}
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
```

#### `features/discovery/shortlists/components/shortlist-metrics-refresh-banner.tsx`

```tsx
"use client";

import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  total: number;
  completed: number;
  failed: number;
  className?: string;
};

export function ShortlistMetricsRefreshBanner({
  total,
  completed,
  failed,
  className,
}: Props) {
  const inFlight = Math.max(0, total - completed);
  const done = completed >= total;

  let message: string;
  if (done) {
    message =
      failed > 0
        ? `Metrics refresh finished — ${failed} of ${total} failed.`
        : `Metrics updated for ${total} creator${total === 1 ? "" : "s"}.`;
  } else if (completed === 0) {
    message = `Collecting metrics for ${total} creator${total === 1 ? "" : "s"}…`;
  } else {
    message = `Collecting metrics… ${completed} of ${total} complete`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2.5 border-b border-sky-500/40 bg-sky-500/10 px-5 py-3 text-xs text-sky-900 dark:text-sky-100 sm:px-6",
        className
      )}
    >
      {!done ? (
        <Loader2Icon className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : null}
      <span className="font-medium">{message}</span>
      {!done && inFlight > 0 ? (
        <span className="text-sky-700/80 dark:text-sky-300/80">
          ({inFlight} in progress)
        </span>
      ) : null}
    </div>
  );
}
```

#### `features/discovery/shortlists/components/shortlist-quotation-panel.tsx`

```tsx
"use client";

import Link from "next/link";
import { ChevronDownIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuotationListStatusPill } from "@/features/quotations/components/quotation-list-status-pill";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { QuotationStatus } from "@/types/database";

import type { ShortlistLinkedQuotation } from "../types";

const ISSUED_STATUSES = new Set<QuotationStatus>([
  "sent",
  "approved",
  "accepted",
]);

function formatDisplayVersion(versionNumber: number): string {
  return `v${versionNumber}`;
}

function quotationCountLabel(count: number): string {
  return count === 1 ? "1 quotation linked" : `${count} quotations linked`;
}

type Props = {
  quotations: ShortlistLinkedQuotation[];
  onGenerateNewVersion: () => void;
  busy?: boolean;
  /** When true, render compact action buttons only (creators toolbar). */
  actionsOnly?: boolean;
};

export function ShortlistQuotationPanel({
  quotations,
  onGenerateNewVersion,
  busy,
  actionsOnly,
}: Props) {
  if (quotations.length === 0) return null;

  const latest = quotations[0];
  const issued = ISSUED_STATUSES.has(latest.status);
  const multiple = quotations.length > 1;
  const detailHref = quotationDetailPath(latest.id);
  const displayVersion = formatDisplayVersion(latest.version_number);

  const openButton = multiple ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={busy}>
          <ExternalLinkIcon className="size-4" />
          Open quotation
          <ChevronDownIcon className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Linked quotations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {quotations.map((q) => (
          <DropdownMenuItem key={q.id} asChild>
            <Link
              href={quotationDetailPath(q.id)}
              className="flex cursor-pointer items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate font-mono text-xs">
                {q.serial_number ?? q.name}
              </span>
              <QuotationListStatusPill status={q.status} />
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button size="sm" asChild disabled={busy}>
      <Link href={detailHref}>
        <ExternalLinkIcon className="size-4" />
        Open quotation
      </Link>
    </Button>
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {openButton}
      <Button size="sm" variant="outline" onClick={onGenerateNewVersion} disabled={busy}>
        <FileTextIcon className="size-4" />
        Generate new version
      </Button>
    </div>
  );

  if (actionsOnly) {
    return actionButtons;
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--tw-border)] bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--text-3)]">
            Quotation
          </p>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {issued ? "Quotation issued" : "Quotation linked"}
              {latest.serial_number ? (
                <>
                  {" · "}
                  <Link
                    href={detailHref}
                    className="font-mono text-[12.5px] font-bold text-[var(--blue-text)] hover:underline"
                  >
                    {latest.serial_number}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="text-xs text-[var(--text-3)]">
              {quotationCountLabel(quotations.length)}
              {" · "}
              Latest version:{" "}
              <span className="font-mono font-semibold text-foreground">
                {displayVersion}
              </span>
            </p>
          </div>
          <QuotationListStatusPill status={latest.status} />
        </div>
        {actionButtons}
      </div>
    </div>
  );
}

export function ShortlistQuotationActions(props: Props) {
  return <ShortlistQuotationPanel {...props} actionsOnly />;
}
```

#### `features/discovery/shortlists/components/shortlist-edit-dialog.tsx`

```tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { updateShortlistDetails } from "../actions";
import type {
  ShortlistBrandOption,
  ShortlistClientOption,
  ShortlistDetail,
} from "../types";

const NO_CLIENT = "";
const NO_BRAND = "";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ShortlistDetail;
  clients: ShortlistClientOption[];
  brands: ShortlistBrandOption[];
};

export function ShortlistEditDialog({
  open,
  onOpenChange,
  detail,
  clients,
  brands,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(detail.name);
  const [description, setDescription] = useState(detail.description ?? "");
  const [clientId, setClientId] = useState(detail.client_id ?? NO_CLIENT);
  const [brandId, setBrandId] = useState(detail.brand_id ?? NO_BRAND);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(detail.name);
    setDescription(detail.description ?? "");
    setClientId(detail.client_id ?? NO_CLIENT);
    setBrandId(detail.brand_id ?? NO_BRAND);
  }, [open, detail]);

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        value: client.id,
        label: client.name,
        description: client.legal_name ?? undefined,
      })),
    [clients]
  );

  const brandOptions = useMemo(() => {
    const filtered = clientId
      ? brands.filter((brand) => brand.client_id === clientId)
      : brands;
    return filtered.map((brand) => ({
      value: brand.id,
      label: brand.name,
      description: brand.client_name ?? undefined,
    }));
  }, [brands, clientId]);

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    if (!nextClientId) {
      setBrandId(NO_BRAND);
      return;
    }
    const brandStillValid = brands.some(
      (brand) => brand.id === brandId && brand.client_id === nextClientId
    );
    if (!brandStillValid) setBrandId(NO_BRAND);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Shortlist name is required.");
      return;
    }

    const hasClient = Boolean(clientId);
    const hasBrand = Boolean(brandId);
    if (hasClient !== hasBrand) {
      toast.error("Select both legal entity and brand, or clear the commercial link.");
      return;
    }

    const commercialChanged =
      (hasClient ? clientId : null) !== detail.client_id ||
      (hasBrand ? brandId : null) !== detail.brand_id;

    startTransition(async () => {
      const result = await updateShortlistDetails({
        shortlistId: detail.id,
        name: trimmedName,
        description: description.trim() || null,
        ...(commercialChanged
          ? {
              clientId: hasClient ? clientId : null,
              brandId: hasBrand ? brandId : null,
            }
          : {}),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message ?? "Shortlist updated.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden border border-white/70 bg-white/75 shadow-[0_24px_64px_-14px_rgba(15,23,42,0.16)]",
          "ring-1 ring-black/[0.04] backdrop-blur-2xl backdrop-saturate-150",
          "dark:border-white/10 dark:bg-[rgba(24,24,27,0.72)] dark:ring-white/[0.06]",
          "sm:max-w-lg"
        )}
      >
        <DialogHeader>
          <DialogTitle>Edit shortlist</DialogTitle>
          <DialogDescription>
            Update the shortlist name, notes, and commercial link for quotations and
            campaigns.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="edit-shortlist-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-shortlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Shortlist name"
              required
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-shortlist-description">Description</Label>
            <Textarea
              id="edit-shortlist-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes"
              rows={2}
              disabled={isPending}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Commercial link</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Link this shortlist to a legal entity and brand. Linked quotations with
                matching or empty client/brand will sync automatically.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Legal entity
                </Label>
                <SearchableSelect
                  options={[{ value: NO_CLIENT, label: "No legal entity" }, ...clientOptions]}
                  value={clientId}
                  onValueChange={handleClientChange}
                  disabled={isPending}
                  placeholder="Select legal entity"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Brand
                </Label>
                <SearchableSelect
                  options={[{ value: NO_BRAND, label: "No brand" }, ...brandOptions]}
                  value={brandId}
                  onValueChange={setBrandId}
                  disabled={isPending || !clientId}
                  placeholder={clientId ? "Select brand" : "Select legal entity first"}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

#### `features/discovery/shortlists/components/submit-shortlist-dialog.tsx`

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SubmitShortlistDialog({
  open,
  onOpenChange,
  creatorCount,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorCount: number;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit entire shortlist?</DialogTitle>
          <DialogDescription>
            No creators are selected. Submit all {creatorCount} creator
            {creatorCount === 1 ? "" : "s"} for review and move the shortlist to
            Under Review?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            Submit all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### `features/discovery/shortlists/components/generate-quotation-shortlist-dialog.tsx`

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function GenerateQuotationShortlistDialog({
  open,
  onOpenChange,
  creatorCount,
  shortlistName,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorCount: number;
  shortlistName: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate quotation for entire shortlist?</DialogTitle>
          <DialogDescription>
            No creators are selected. Create a quotation with all {creatorCount} creator
            {creatorCount === 1 ? "" : "s"} from &ldquo;{shortlistName}&rdquo;?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            Generate quotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### `features/discovery/shortlists/components/move-to-campaign-dialog.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { moveShortlistToCampaign } from "../actions";
import {
  buildNameMismatchWarning,
  shouldWarnNameMismatch,
  type MoveTarget,
} from "../move-policy";
import type { ShortlistBrandOption, ShortlistCampaignOption } from "../types";

type Mode = "existing" | "new";

export function MoveToCampaignDialog({
  open,
  onOpenChange,
  shortlistId,
  shortlistName,
  selectedItemIds,
  campaigns,
  brands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortlistId: string;
  shortlistName: string;
  selectedItemIds: string[];
  campaigns: ShortlistCampaignOption[];
  brands: ShortlistBrandOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("existing");
  const [campaignId, setCampaignId] = useState<string>("");
  const [brandId, setBrandId] = useState<string>("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) ?? null,
    [campaigns, campaignId]
  );

  function buildTarget(): MoveTarget | null {
    if (mode === "existing") {
      if (!selectedCampaign) return null;
      return {
        mode: "existing",
        campaignId: selectedCampaign.id,
        campaignName: selectedCampaign.name,
      };
    }
    return {
      mode: "new",
      name,
      brandId,
      country: country || null,
      startDate: startDate || null,
      endDate: endDate || null,
      budget: budget ? Number(budget) : null,
    };
  }

  function submit(acknowledgeNameMismatch: boolean) {
    const target = buildTarget();
    if (!target) {
      toast.error("Select a campaign to move creators into.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await moveShortlistToCampaign({
          shortlistId,
          itemIds: selectedItemIds,
          target,
          acknowledgeNameMismatch,
        });
        if (result.ok) {
          toast.success(result.message ?? "Creators moved");
          setPendingWarning(null);
          onOpenChange(false);
          if (result.campaignId) {
            router.push(`/campaigns/${result.campaignId}`);
          }
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Move failed");
      }
    });
  }

  function handlePrimary() {
    if (selectedItemIds.length === 0) {
      toast.error("Select at least one creator to move.");
      return;
    }

    if (mode === "existing") {
      const campaign = selectedCampaign;
      if (!campaign) {
        toast.error("Select a campaign.");
        return;
      }
      // Spec §8 — warn when the shortlist name differs from the campaign name.
      if (shouldWarnNameMismatch(shortlistName, campaign.name)) {
        setPendingWarning(
          buildNameMismatchWarning(campaign.document_number ?? campaign.name)
        );
        return;
      }
    }

    submit(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        {pendingWarning ? (
          <>
            <DialogHeader>
              <DialogTitle>Confirm campaign move</DialogTitle>
              <DialogDescription>{pendingWarning}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPendingWarning(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={() => submit(true)} disabled={isPending}>
                {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Move {selectedItemIds.length} creator(s) to campaign</DialogTitle>
              <DialogDescription>
                Selected creators will be assigned with status “Suggested”.
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "existing" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("existing")}
              >
                Existing campaign
              </Button>
              <Button
                type="button"
                variant={mode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("new")}
              >
                New campaign
              </Button>
            </div>

            {mode === "existing" ? (
              <div className="space-y-1.5">
                <Label htmlFor="move-campaign">Campaign</Label>
                <Select value={campaignId} onValueChange={setCampaignId} disabled={isPending}>
                  <SelectTrigger id="move-campaign">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.document_number
                          ? `${campaign.document_number} · ${campaign.name}`
                          : campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-campaign-name">
                    Campaign name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-campaign-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Spring Launch"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-campaign-brand">
                    Brand <span className="text-destructive">*</span>
                  </Label>
                  <Select value={brandId} onValueChange={setBrandId} disabled={isPending}>
                    <SelectTrigger id="new-campaign-brand">
                      <SelectValue placeholder="Select a brand (sets client)" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.client_name
                            ? `${brand.name} · ${brand.client_name}`
                            : brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-campaign-country">Country</Label>
                    <Input
                      id="new-campaign-country"
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      placeholder="e.g. SA"
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-campaign-budget">Budget</Label>
                    <Input
                      id="new-campaign-budget"
                      type="number"
                      min={0}
                      value={budget}
                      onChange={(event) => setBudget(event.target.value)}
                      placeholder="0"
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-campaign-start">Start date</Label>
                    <Input
                      id="new-campaign-start"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-campaign-end">End date</Label>
                    <Input
                      id="new-campaign-end"
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      disabled={isPending}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A TW-YYYY-NNNN number is generated automatically and the campaign
                  starts in Draft.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handlePrimary} disabled={isPending}>
                {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Move creators
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

#### `features/discovery/shortlists/components/add-creators-drawer.tsx`

```tsx
"use client";

import { ShortlistCreatorPicker } from "@/features/creators/picker/shortlist-creator-picker";
import type { ExistingCreatorKey } from "@/features/creators/picker/creator-selection-types";

export function AddCreatorsDrawer({
  open,
  onOpenChange,
  shortlistId,
  existingItems,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortlistId: string;
  existingItems: ExistingCreatorKey[];
  onAdded: () => void;
}) {
  return (
    <ShortlistCreatorPicker
      open={open}
      onOpenChange={onOpenChange}
      shortlistId={shortlistId}
      existingItems={existingItems}
      onAdded={onAdded}
    />
  );
}
```


---

## 3 — Shortlist creator sort + constants

Sort state for Safety / Sync / Status / Quoted columns on detail creator list.

#### `features/discovery/shortlists/shortlist-creator-sort.ts`

```ts
import { filterPlatformsForDisplay } from "@/lib/creators/creator-centric";
import { resolveDiscoveryCreatorDisplayCategories } from "@/lib/creators/creator-display-categories";
import {
  INFLUENCER_TIER_ORDER,
  resolveCreatorTierFromUnified,
  type CreatorTierLabel,
} from "@/lib/creators/creator-tier";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  resolveEnrichmentDisplayStatus,
  type CreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import {
  resolveSortEngagement,
  resolveSortFollowers,
} from "@/features/discovery/components/creator-search/creator-search-sort";
import type { ShortlistItemStatus } from "@/types/database";

import { SHORTLIST_ITEM_STATUSES } from "./constants";
import type { ShortlistCreatorQuotationRef } from "./types";

export type ShortlistCreatorSortField =
  | "rank"
  | "creator"
  | "platform"
  | "followers"
  | "tier"
  | "country"
  | "interests"
  | "engagement"
  | "brand_safety"
  | "sync"
  | "status"
  | "quoted";

export type ShortlistCreatorSortDirection = "asc" | "desc";

export type ShortlistCreatorSortState = {
  field: ShortlistCreatorSortField;
  direction: ShortlistCreatorSortDirection;
};

export type ShortlistSortableRow = {
  item_id: string;
  item_status: ShortlistItemStatus;
  creator: UnifiedCreatorResult | null;
  quotation_refs: ShortlistCreatorQuotationRef[];
};

const ENRICHMENT_STATUS_ORDER: CreatorEnrichmentStatus[] = [
  "never",
  "queued",
  "running",
  "partial",
  "enriched",
  "failed",
  "skipped",
];

const DEFAULT_DIRECTION: Record<ShortlistCreatorSortField, ShortlistCreatorSortDirection> = {
  rank: "asc",
  creator: "asc",
  platform: "asc",
  followers: "desc",
  tier: "desc",
  country: "asc",
  interests: "asc",
  engagement: "desc",
  brand_safety: "desc",
  sync: "asc",
  status: "asc",
  quoted: "desc",
};

function compareNumbers(
  left: number,
  right: number,
  direction: ShortlistCreatorSortDirection
): number {
  const delta = left - right;
  return direction === "asc" ? delta : -delta;
}

function compareStrings(
  left: string,
  right: string,
  direction: ShortlistCreatorSortDirection
): number {
  const cmp = left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
  return direction === "asc" ? cmp : -cmp;
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: ShortlistCreatorSortDirection
): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return compareNumbers(left, right, direction);
}

function compareNullableStrings(
  left: string | null,
  right: string | null,
  direction: ShortlistCreatorSortDirection
): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return compareStrings(left, right, direction);
}

function resolveSortPlatform(creator: UnifiedCreatorResult): string {
  return [...creator.platforms]
    .map((platform) => platform.platform.trim().toLowerCase())
    .sort()
    .join(", ");
}

function resolveSortCountry(creator: UnifiedCreatorResult): string {
  const primary = creator.platforms[0];
  return (
    primary?.audience_country ??
    creator.estimated_country ??
    creator.country_code ??
    ""
  )
    .trim()
    .toUpperCase();
}

function resolveSortBrandSafety(creator: UnifiedCreatorResult): number {
  return creator.authenticity_score ?? -1;
}

function tierSortIndex(tier: CreatorTierLabel): number {
  const idx = INFLUENCER_TIER_ORDER.indexOf(tier as (typeof INFLUENCER_TIER_ORDER)[number]);
  return idx === -1 ? INFLUENCER_TIER_ORDER.length : idx;
}

function resolveInterestsSortValue(creator: UnifiedCreatorResult | null): string | null {
  if (!creator) return null;
  const parts = resolveDiscoveryCreatorDisplayCategories(creator);
  return parts.length > 0 ? parts.join(", ").toLowerCase() : null;
}

function resolveSyncSortValue(creator: UnifiedCreatorResult | null): number | null {
  if (!creator) return null;
  const status = resolveEnrichmentDisplayStatus(creator.enrichment_status, creator);
  const idx = ENRICHMENT_STATUS_ORDER.indexOf(status);
  return idx === -1 ? ENRICHMENT_STATUS_ORDER.length : idx;
}

function resolveStatusSortValue(status: ShortlistItemStatus): number {
  const idx = SHORTLIST_ITEM_STATUSES.indexOf(status);
  return idx === -1 ? SHORTLIST_ITEM_STATUSES.length : idx;
}

function resolveQuotedSortValue(refs: ShortlistCreatorQuotationRef[]): number {
  return refs.length;
}

function resolveCreatorName(creator: UnifiedCreatorResult | null): string | null {
  return creator?.display_name?.trim() || null;
}

function resolveEngagementSortValue(creator: UnifiedCreatorResult | null): number | null {
  if (!creator) return null;
  const displayPlatforms = filterPlatformsForDisplay(creator.platforms);
  if (displayPlatforms.length === 1) {
    const rate = displayPlatforms[0]?.engagement_rate;
    return rate != null && Number.isFinite(rate) ? rate : null;
  }
  const rate = resolveSortEngagement(creator);
  return Number.isFinite(rate) ? rate : null;
}

export function defaultDirectionForShortlistSortField(
  field: ShortlistCreatorSortField
): ShortlistCreatorSortDirection {
  return DEFAULT_DIRECTION[field];
}

export function applyShortlistHeaderSort(
  current: ShortlistCreatorSortState | null,
  field: ShortlistCreatorSortField
): ShortlistCreatorSortState {
  if (current?.field === field) {
    return {
      field,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return { field, direction: defaultDirectionForShortlistSortField(field) };
}

function compareRows(
  left: { row: ShortlistSortableRow; index: number },
  right: { row: ShortlistSortableRow; index: number },
  sort: ShortlistCreatorSortState
): number {
  const { field, direction } = sort;
  const leftCreator = left.row.creator;
  const rightCreator = right.row.creator;

  let primary = 0;

  switch (field) {
    case "rank":
      primary = compareNumbers(left.index, right.index, direction);
      break;
    case "creator":
      primary = compareNullableStrings(
        resolveCreatorName(leftCreator),
        resolveCreatorName(rightCreator),
        direction
      );
      break;
    case "platform":
      primary = compareNullableStrings(
        leftCreator ? resolveSortPlatform(leftCreator) || null : null,
        rightCreator ? resolveSortPlatform(rightCreator) || null : null,
        direction
      );
      break;
    case "followers":
      primary = compareNullableNumbers(
        leftCreator ? resolveSortFollowers(leftCreator) : null,
        rightCreator ? resolveSortFollowers(rightCreator) : null,
        direction
      );
      break;
    case "tier":
      primary = compareNullableNumbers(
        leftCreator ? tierSortIndex(resolveCreatorTierFromUnified(leftCreator)) : null,
        rightCreator ? tierSortIndex(resolveCreatorTierFromUnified(rightCreator)) : null,
        direction
      );
      break;
    case "country":
      primary = compareNullableStrings(
        leftCreator ? resolveSortCountry(leftCreator) || null : null,
        rightCreator ? resolveSortCountry(rightCreator) || null : null,
        direction
      );
      break;
    case "interests":
      primary = compareNullableStrings(
        resolveInterestsSortValue(leftCreator),
        resolveInterestsSortValue(rightCreator),
        direction
      );
      break;
    case "engagement":
      primary = compareNullableNumbers(
        resolveEngagementSortValue(leftCreator),
        resolveEngagementSortValue(rightCreator),
        direction
      );
      break;
    case "brand_safety":
      primary = compareNullableNumbers(
        leftCreator ? resolveSortBrandSafety(leftCreator) : null,
        rightCreator ? resolveSortBrandSafety(rightCreator) : null,
        direction
      );
      break;
    case "sync":
      primary = compareNullableNumbers(
        resolveSyncSortValue(leftCreator),
        resolveSyncSortValue(rightCreator),
        direction
      );
      break;
    case "status":
      primary = compareNumbers(
        resolveStatusSortValue(left.row.item_status),
        resolveStatusSortValue(right.row.item_status),
        direction
      );
      break;
    case "quoted":
      primary = compareNumbers(
        resolveQuotedSortValue(left.row.quotation_refs),
        resolveQuotedSortValue(right.row.quotation_refs),
        direction
      );
      break;
  }

  if (primary !== 0) {
    return primary;
  }

  return compareNumbers(left.index, right.index, "asc");
}

/** Stable client-side sort over the loaded shortlist rows. */
export function sortShortlistCreators<T extends ShortlistSortableRow>(
  items: readonly T[],
  sort: ShortlistCreatorSortState | null
): T[] {
  if (!sort) {
    return [...items];
  }

  const indexed = items.map((row, index) => ({ row, index }));
  indexed.sort((left, right) => compareRows(left, right, sort));
  return indexed.map(({ row }) => row);
}
```

#### `features/discovery/shortlists/constants.ts`

```ts
import type {
  CampaignShortlistAssignmentStatus,
  ShortlistStatus,
  ShortlistVisibilityV2,
} from "@/types/database";

export const SHORTLIST_STATUSES: ShortlistStatus[] = [
  "draft",
  "under_review",
  "approved",
  "cancelled",
  "archived",
];

export const SHORTLIST_STATUS_LABELS: Record<ShortlistStatus, string> = {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  cancelled: "Cancelled",
  archived: "Archived",
};

export const SHORTLIST_VISIBILITIES: ShortlistVisibilityV2[] = [
  "private",
  "team",
  "client_shared",
];

export const SHORTLIST_VISIBILITY_LABELS: Record<ShortlistVisibilityV2, string> = {
  private: "Private",
  team: "Team",
  client_shared: "Client Shared",
};

/**
 * Visibilities a user can pick in the UI today. "client_shared" is supported in
 * schema/enums (spec §4, §12 client-portal-ready) but intentionally not selectable
 * until the client portal ships.
 */
export const SELECTABLE_SHORTLIST_VISIBILITIES: ShortlistVisibilityV2[] = [
  "private",
  "team",
];

export const ASSIGNMENT_STATUS_LABELS: Record<
  CampaignShortlistAssignmentStatus,
  string
> = {
  suggested: "Suggested",
  invited: "Invited",
  approved: "Approved",
  contracted: "Contracted",
  published: "Published",
  rejected: "Rejected",
  removed: "Removed",
};

export const SHORTLIST_ITEM_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "rejected",
  "moved_to_campaign",
  "cancelled",
] as const;

export const SHORTLIST_ITEM_STATUS_LABELS: Record<
  (typeof SHORTLIST_ITEM_STATUSES)[number],
  string
> = {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  moved_to_campaign: "Moved To Campaign",
  cancelled: "Cancelled",
};

/** Shortlist creator table — tracks creators sent to a linked quotation. */
export const SHORTLIST_QUOTED_COLUMN_LABEL = "Quoted";

/** Permission slugs powering shortlist authorization (spec §16). */
export const SHORTLIST_PERMISSIONS = {
  /** Discovery User — create/edit own drafts, add creators. */
  write: "discovery.write",
  /** Read team / client-shared shortlists. */
  read: "discovery.read",
  /** Team Leader / Admin — approve, reject, manage any shortlist. */
  admin: "discovery.admin",
} as const;

export function shortlistDetailPath(shortlistId: string): string {
  return `/discovery/shortlists/${shortlistId}`;
}

export function shortlistPreviewPath(
  shortlistId: string,
  options?: { template?: "summary" | "detailed" | "showcase"; itemIds?: string[] }
): string {
  const params = new URLSearchParams();
  if (options?.template && options.template !== "summary") {
    params.set("template", options.template);
  }
  if (options?.itemIds?.length) {
    params.set("items", options.itemIds.join(","));
  }
  const query = params.toString();
  return `/discovery/shortlists/${shortlistId}/preview${query ? `?${query}` : ""}`;
}
```

#### `features/discovery/shortlists/types.ts`

```ts
import type {
  CampaignShortlistAssignmentStatus,
  CreatorMovementAction,
  QuotationStatus,
  ShortlistItemStatus,
  ShortlistStatus,
  ShortlistVisibilityV2,
} from "@/types/database";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type ShortlistCreatorPreview = {
  display_name: string;
  profile_image_url: string | null;
};

export type ShortlistListRow = {
  id: string;
  serial_number: string | null;
  name: string;
  description: string | null;
  status: ShortlistStatus;
  visibility: ShortlistVisibilityV2;
  owner_id: string;
  owner_name: string | null;
  client_id: string | null;
  client_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  is_archived: boolean;
  creator_count: number;
  creator_previews: ShortlistCreatorPreview[];
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ShortlistCreatorQuotationRef = {
  quotation_id: string;
  serial_number: string | null;
  name: string;
  status: QuotationStatus;
};

export type ShortlistCreatorItem = {
  item_id: string;
  item_status: ShortlistItemStatus;
  notes: string | null;
  match_score: number | null;
  unified_id: string | null;
  profile_id: string | null;
  influencer_id: string | null;
  platform_account_ids: string[];
  creator: UnifiedCreatorResult | null;
  /** Quotations this creator has been sent to from this shortlist. */
  quotation_refs: ShortlistCreatorQuotationRef[];
};

export type ShortlistMovementRow = {
  id: string;
  action: CreatorMovementAction;
  source_type: string;
  destination_type: string;
  source_id: string | null;
  destination_id: string | null;
  unified_id: string | null;
  notes: string | null;
  performed_at: string;
  performed_by: string | null;
  performed_by_name: string | null;
};

export type ShortlistLinkedQuotation = {
  id: string;
  serial_number: string | null;
  name: string;
  status: QuotationStatus;
  version_number: number;
  created_at: string;
};

export type ShortlistMovedAssignment = {
  assignment_id: string;
  campaign_header_id: string;
  campaign_name: string | null;
  campaign_document_number: string | null;
  influencer_id: string;
  influencer_name: string | null;
  assignment_status: CampaignShortlistAssignmentStatus | null;
};

export type ShortlistDetail = {
  id: string;
  serial_number: string | null;
  name: string;
  description: string | null;
  status: ShortlistStatus;
  visibility: ShortlistVisibilityV2;
  owner_id: string;
  owner_name: string | null;
  created_by: string | null;
  client_id: string | null;
  client_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  creators: ShortlistCreatorItem[];
  movements: ShortlistMovementRow[];
  movedAssignments: ShortlistMovedAssignment[];
  linkedQuotations: ShortlistLinkedQuotation[];
  canManage: boolean;
  canApprove: boolean;
};

export type ShortlistCampaignOption = {
  id: string;
  name: string;
  document_number: string | null;
};

export type ShortlistClientOption = {
  id: string;
  name: string;
  legal_name: string | null;
};

export type ShortlistBrandOption = {
  id: string;
  name: string;
  client_id: string;
  client_name: string | null;
};

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };
```


---

## 4 — Shared Discovery list chrome (used by Shortlists list)

Same list card / table head tokens as Quotations. Filter bar uses DiscoveryFilterBar (embedded strip, not the Search filter drawer).

#### `features/discovery/components/discovery-list-primitives.tsx`

```tsx
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Shared Discovery list table header cell — matches Search list typography. */
export const DISCOVERY_TABLE_HEAD_CLASS =
  "h-auto px-3.5 py-[11px] text-[9.5px] font-bold uppercase tracking-[0.5px] text-muted-foreground bg-muted/40";

/** Shared Discovery list table body cell. */
export const DISCOVERY_TABLE_CELL_CLASS =
  "px-3.5 py-3 align-middle text-[12.5px] text-[var(--text-2)] dark:text-muted-foreground";

/** Shared Discovery list table row hover. */
export const DISCOVERY_TABLE_ROW_CLASS = "hover:bg-muted/30";

/** Bordered card shell for Discovery list tables and sections. */
export const DISCOVERY_LIST_CARD_CLASS =
  "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--tw-border)] bg-background";

type DiscoveryListCardProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
};

export function DiscoveryListCard({
  children,
  className,
  ...props
}: DiscoveryListCardProps) {
  return (
    <div className={cn(DISCOVERY_LIST_CARD_CLASS, className)} {...props}>
      {children}
    </div>
  );
}
```

#### `features/discovery/components/design-system/discovery-design-tokens.ts`

```ts
/**
 * Discovery platform design tokens — single source for class constants.
 * Golden reference: Discovery Search (`discovery-search-exact-*`, DiscoveryPageShell list variant).
 */

export {
  DISCOVERY_LIST_CARD_CLASS,
  DISCOVERY_TABLE_CELL_CLASS,
  DISCOVERY_TABLE_HEAD_CLASS,
  DISCOVERY_TABLE_ROW_CLASS,
  DiscoveryListCard,
} from "@/features/discovery/components/discovery-list-primitives";

/** List-variant page canvas (lavender scroll region). */
export const DISCOVERY_LIST_CANVAS_CLASS =
  "min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--lavender)] px-4 pt-5 pb-[60px] dark:bg-background";

/** Embedded filter bar inside a list card. */
export const DISCOVERY_FILTER_BAR_CLASS =
  "flex flex-wrap items-center gap-2.5 border-b border-[var(--tw-border)] bg-background px-4 py-3.5";

/** Standalone filter bar (outside card). */
export const DISCOVERY_FILTER_BAR_STANDALONE_CLASS =
  "flex flex-wrap items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2";

/** Card section header strip (Import, list modules). */
export const DISCOVERY_SECTION_HEADER_CLASS =
  "border-b border-[var(--tw-border)] bg-muted/30 px-4 py-3.5";

/** Page header title — matches DiscoveryPageHeader. */
export const DISCOVERY_PAGE_TITLE_CLASS =
  "text-[18px] font-extrabold tracking-[-0.3px] text-[var(--text)] dark:text-foreground";

export const DISCOVERY_PAGE_DESC_CLASS = "mt-px text-xs text-[var(--text-3)]";

/** In-card section title. */
export const DISCOVERY_SECTION_TITLE_CLASS = "text-[12.5px] font-bold text-foreground";

export const DISCOVERY_SECTION_DESC_CLASS =
  "mt-0.5 max-w-2xl text-xs leading-relaxed text-[var(--text-3)]";

/** Exact-search toolbar row container. */
export const DISCOVERY_TOOLBAR_ROW_CLASS = "discovery-search-exact-toolbar";

/** Creator Details drawer max width (px) — keep in sync with `creator-detail-sheet.tsx`. */
export const CREATOR_DETAIL_SHEET_MAX_WIDTH_PX = 690;

/** Similar creators rail inside Creator Details (px). */
export const CREATOR_DETAIL_SHEET_SIMILAR_RAIL_WIDTH_PX = 210;

/** Discovery filter drawer = Creator Details width − 30%. */
export const DISCOVERY_FILTER_SHEET_MAX_WIDTH_PX = Math.round(
  CREATOR_DETAIL_SHEET_MAX_WIDTH_PX * 0.7
);
```

#### `features/discovery/components/design-system/discovery-filter-bar.tsx`

```tsx
"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  DISCOVERY_FILTER_BAR_CLASS,
  DISCOVERY_FILTER_BAR_STANDALONE_CLASS,
} from "./discovery-design-tokens";

type DiscoveryFilterBarProps = {
  children: ReactNode;
  /** Result count label shown at the end (e.g. "12 of 48 shortlists"). */
  countLabel?: string;
  /** Inside a DiscoveryListCard — uses bordered bottom strip. */
  embedded?: boolean;
  className?: string;
};

/** Shared filter/search bar chrome for Discovery list pages. */
export function DiscoveryFilterBar({
  children,
  countLabel,
  embedded = true,
  className,
}: DiscoveryFilterBarProps) {
  return (
    <div
      className={cn(
        embedded ? DISCOVERY_FILTER_BAR_CLASS : DISCOVERY_FILTER_BAR_STANDALONE_CLASS,
        className
      )}
    >
      {children}
      {countLabel ? (
        <span className="ml-auto shrink-0 text-[11px] font-medium text-[var(--text-3)]">
          {countLabel}
        </span>
      ) : null}
    </div>
  );
}
```

#### `features/discovery/components/design-system/discovery-empty-state.tsx`

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DiscoveryEmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
};

/** Centered empty state — matches Search zero-result spacing. */
export function DiscoveryEmptyState({
  title,
  description,
  icon: Icon,
  children,
  className,
}: DiscoveryEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-24 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--text-3)]">
          <Icon className="size-6" strokeWidth={1.75} />
        </div>
      ) : null}
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-col items-center gap-2">{children}</div> : null}
    </div>
  );
}
```

#### `features/discovery/components/design-system/discovery-filtered-empty-state.tsx`

```tsx
"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { DiscoveryEmptyState } from "./discovery-empty-state";

type DiscoveryFilteredEmptyStateProps = {
  title: string;
  description?: string;
  onReset: () => void;
  resetLabel?: string;
  children?: ReactNode;
  className?: string;
};

/** In-table filtered-empty state with optional reset — list pages. */
export function DiscoveryFilteredEmptyState({
  title,
  description = "Try adjusting search or filter criteria.",
  onReset,
  resetLabel = "Reset filters",
  children,
  className,
}: DiscoveryFilteredEmptyStateProps) {
  return (
    <DiscoveryEmptyState
      title={title}
      description={description}
      className={className ?? "py-10"}
    >
      {children}
      <Button type="button" size="sm" variant="secondary" onClick={onReset}>
        {resetLabel}
      </Button>
    </DiscoveryEmptyState>
  );
}
```

#### `features/discovery/components/discovery-page-shell.tsx`

```tsx
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { cn } from "@/lib/utils";

import {
  DISCOVERY_PAGE_IDENTITY,
  DiscoveryPageHeader,
  type DiscoveryPageKey,
} from "./discovery-page-identity";

export type DiscoveryPageShellVariant = "list" | "workspace" | "flush";

type DiscoveryPageShellProps = {
  page: DiscoveryPageKey;
  /** Override Discovery topnav active matching (defaults to page identity href). */
  activeHref?: string;
  /**
   * list — lavender canvas + padded scroll region + optional page header
   * workspace — campaign-surface / muted workspace (detail pages)
   * flush — full-bleed content under the shell topbar (Creator Search)
   */
  variant?: DiscoveryPageShellVariant;
  /** When false, skip DiscoveryPageHeader (e.g. flush workspaces with their own top bar). */
  showHeader?: boolean;
  headerActions?: ReactNode;
  /** Extra chrome above children (e.g. back bar on detail pages). */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function DiscoveryPageShell({
  page,
  activeHref,
  variant = "list",
  showHeader = variant !== "flush",
  headerActions,
  toolbar,
  children,
  className,
  contentClassName,
}: DiscoveryPageShellProps) {
  const identity = DISCOVERY_PAGE_IDENTITY[page];
  const href = activeHref ?? identity.href;

  return (
    <DashboardShell
      title={identity.title}
      description={identity.description}
      hidePageHeader
      containedMain
      discoveryNavActiveHref={href}
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      headerClassName="h-14 px-4 py-0 md:px-4"
    >
      <PlatformErrorBoundary surface="generic">
        <div
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden",
            className
          )}
        >
          {toolbar}
          {variant === "flush" ? (
            <div className={cn("min-h-0 flex-1 overflow-hidden", contentClassName)}>
              {children}
            </div>
          ) : variant === "workspace" ? (
            <div
              className={cn(
                "thinkway-campaign-workspace flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[var(--camp-surface)]",
                contentClassName
              )}
              data-campaign-workspace-scroll
            >
              {showHeader ? (
                <div className="space-y-4 p-4 md:p-5">
                  <DiscoveryPageHeader
                    identity={identity}
                    actions={headerActions}
                  />
                  {children}
                </div>
              ) : (
                children
              )}
            </div>
          ) : (
            /* HTML `.content`: page-head sits on lavender canvas; only children are card-bounded. */
            <div
              className={cn(
                "min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--lavender)] px-4 pt-5 pb-[60px] dark:bg-background",
                contentClassName
              )}
            >
              {showHeader ? (
                <DiscoveryPageHeader
                  identity={identity}
                  actions={headerActions}
                />
              ) : null}
              {children}
            </div>
          )}
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
```

#### `features/discovery/components/discovery-page-identity.tsx`

```tsx
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRightIcon,
  BrainIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ListChecksIcon,
  RadarIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type DiscoveryPageKey =
  | "search"
  | "compare"
  | "intelligence"
  | "shortlists"
  | "quotations"
  | "campaign-match"
  | "import";

export type DiscoveryPageIdentity = {
  key: DiscoveryPageKey;
  href: string;
  navLabel: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  iconClass: string;
  /** Solid icon tile (list page headers) — overrides gradient badge when set. */
  iconSolidClass?: string;
};

export const DISCOVERY_PAGE_IDENTITY: Record<DiscoveryPageKey, DiscoveryPageIdentity> = {
  search: {
    key: "search",
    href: "/discovery/search",
    navLabel: "Search",
    title: "Creator Search",
    description: "Browse, filter, and shortlist creators across platforms.",
    icon: SearchIcon,
    accent: "from-sky-400/25 via-sky-300/15 to-blue-500/10",
    iconClass: "text-sky-700 dark:text-sky-300",
    iconSolidClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
  compare: {
    key: "compare",
    href: "/discovery/compare",
    navLabel: "Compare",
    title: "Creator Comparison",
    description: "Compare creators side by side across metrics and platforms.",
    icon: ArrowLeftRightIcon,
    accent: "from-indigo-400/25 via-indigo-300/15 to-blue-500/10",
    iconClass: "text-indigo-700 dark:text-indigo-300",
    iconSolidClass: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  intelligence: {
    key: "intelligence",
    href: "/discovery/intelligence/library",
    navLabel: "Intelligence",
    title: "Campaign Intelligence Library",
    description: "Shared brief intelligence for Discovery, campaigns, Studio, and AI workflows.",
    icon: BrainIcon,
    accent: "from-teal-400/25 via-teal-300/15 to-emerald-500/10",
    iconClass: "text-teal-700 dark:text-teal-300",
    iconSolidClass: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  },
  shortlists: {
    key: "shortlists",
    href: "/discovery/shortlists",
    navLabel: "Shortlists",
    title: "Shortlists",
    description: "Build, review, approve, and move creators into campaigns.",
    icon: ListChecksIcon,
    accent: "from-violet-400/25 via-violet-300/15 to-purple-500/10",
    iconClass: "text-violet-700 dark:text-violet-300",
    iconSolidClass: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  },
  quotations: {
    key: "quotations",
    href: "/discovery/quotations",
    navLabel: "Client Quotations",
    title: "Client Quotations",
    description: "Serial-numbered quotations (QT-YYYY-NNNN). Totals reported in EGP.",
    icon: FileTextIcon,
    accent: "from-amber-400/25 via-amber-300/15 to-orange-500/10",
    iconClass: "text-amber-800 dark:text-amber-300",
    iconSolidClass:
      "bg-[var(--amber-bg)] text-[var(--amber-text)] dark:bg-amber-950/50 dark:text-amber-300",
  },
  "campaign-match": {
    key: "campaign-match",
    href: "/discovery/campaign-match",
    navLabel: "Campaign Match",
    title: "Campaign Match",
    description: "Match discovered creators to campaign briefs with AI scoring.",
    icon: RadarIcon,
    accent: "from-rose-400/25 via-rose-300/15 to-pink-500/10",
    iconClass: "text-rose-700 dark:text-rose-300",
    iconSolidClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
  import: {
    key: "import",
    href: "/discovery/import",
    navLabel: "Import Center",
    title: "Discovery Import Center",
    description: "Upload creator datasets from agencies, platforms, or clients.",
    icon: UploadIcon,
    accent: "from-emerald-400/25 via-emerald-300/15 to-teal-500/10",
    iconClass: "text-emerald-700 dark:text-emerald-300",
    iconSolidClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
};

export const DISCOVERY_SUB_NAV_PAGES: DiscoveryPageIdentity[] = [
  DISCOVERY_PAGE_IDENTITY.search,
  DISCOVERY_PAGE_IDENTITY.intelligence,
  DISCOVERY_PAGE_IDENTITY.shortlists,
  DISCOVERY_PAGE_IDENTITY.quotations,
  DISCOVERY_PAGE_IDENTITY["campaign-match"],
  DISCOVERY_PAGE_IDENTITY.import,
];

type DiscoveryPageIconBadgeProps = {
  identity: DiscoveryPageIdentity;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const BADGE_SIZE = {
  sm: "size-6 rounded-md [&_svg]:size-3",
  md: "size-[38px] rounded-[10px] [&_svg]:size-[19px]",
  lg: "size-12 rounded-xl [&_svg]:size-6",
} as const;

export function DiscoveryPageIconBadge({
  identity,
  size = "md",
  className,
}: DiscoveryPageIconBadgeProps) {
  const Icon = identity.icon;
  const solid = identity.iconSolidClass;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        solid
          ? cn(solid, BADGE_SIZE[size])
          : cn(
              "border border-white/60 bg-gradient-to-br shadow-sm backdrop-blur-sm",
              "dark:border-white/10",
              identity.accent,
              BADGE_SIZE[size]
            ),
        className
      )}
      aria-hidden
    >
      <Icon className={identity.iconClass} />
    </div>
  );
}

type DiscoveryPageHeaderProps = {
  identity: DiscoveryPageIdentity;
  actions?: ReactNode;
  className?: string;
};

export function DiscoveryPageHeader({
  identity,
  actions,
  className,
}: DiscoveryPageHeaderProps) {
  return (
    <section
      className={cn(
        /* HTML `.page-head`: items-center, gap 16px, margin-bottom via parent space-y-4 */
        "flex flex-wrap items-center justify-between gap-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <DiscoveryPageIconBadge identity={identity} />
        <div className="min-w-0">
          <h2 className="text-[18px] font-extrabold tracking-[-0.3px] text-[var(--text)] dark:text-foreground">
            {identity.title}
          </h2>
          <p className="mt-px text-xs text-[var(--text-3)]">{identity.description}</p>
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </section>
  );
}

/** Spreadsheet accent for import upload sections */
export const DISCOVERY_IMPORT_UPLOAD_IDENTITY: Pick<
  DiscoveryPageIdentity,
  "icon" | "accent" | "iconClass"
> = {
  icon: FileSpreadsheetIcon,
  accent: "from-slate-400/20 via-slate-300/10 to-slate-500/5",
  iconClass: "text-slate-600 dark:text-slate-400",
};
```


---

## 5 — Shared Discovery workspace chrome (detail toolbar)

Back bar + Open Studio / Generate Outputs actions on detail page.

#### `features/discovery/components/design-system/discovery-workspace-chrome.tsx`

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DISCOVERY_WORKSPACE_TOOLBAR_CLASS =
  "flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 md:px-6";

export const DISCOVERY_WORKSPACE_INNER_CLASS =
  "mx-auto w-full max-w-[1800px] px-4 py-5 md:px-6 md:py-6";

export const DISCOVERY_WORKSPACE_ACTION_BAR_CLASS =
  "flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-3 md:px-5";

type DiscoveryWorkspaceToolbarProps = {
  backHref: string;
  backLabel: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

/** Detail workspace top bar — back link, optional meta, right actions. */
export function DiscoveryWorkspaceToolbar({
  backHref,
  backLabel,
  actions,
  meta,
  className,
}: DiscoveryWorkspaceToolbarProps) {
  return (
    <div className={cn(DISCOVERY_WORKSPACE_TOOLBAR_CLASS, className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
        {meta ? (
          <>
            <span className="hidden h-4 w-px bg-[#E6EAF2] dark:bg-border sm:block" aria-hidden />
            <div className="text-[12px] font-semibold text-foreground">{meta}</div>
          </>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type DiscoveryWorkspaceActionBarProps = {
  leading?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Flush workspace action row (Compare, Search sub-regions). */
export function DiscoveryWorkspaceActionBar({
  leading,
  meta,
  actions,
  className,
}: DiscoveryWorkspaceActionBarProps) {
  return (
    <div className={cn(DISCOVERY_WORKSPACE_ACTION_BAR_CLASS, className)}>
      {leading}
      {meta ? <span className="text-[12px] font-semibold text-foreground">{meta}</span> : null}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
```


---

## 6 — Creator exact row (detail creator list)

Shortlist detail reuses DiscoveryCreatorExactRow + DiscoveryCreatorExactHeader from Search. Full canonical source included here.

#### `features/discovery/components/discovery-creator-exact-row.tsx`

```tsx
"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { memo, type MouseEvent, type ReactNode } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CountryFlagBadge } from "@/components/creator/country-flag-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { InterestChips } from "@/features/discovery/components/discovery-interest-chips";
import {
  DiscoveryCreatorFeedThumbs,
  DiscoveryCreatorPlatformStatsBox,
} from "@/features/discovery/components/discovery-creator-platform-stats";
import {
  buildDiscoveryCreatorViewModel,
  resolveDiscoveryCreatorMetaLabel,
} from "@/features/discovery/view-models/discovery-creator-view-model";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

import { CreatorAvatarHoverTrigger } from "./creator-search/creator-avatar-hover-trigger";

/** @deprecated Use resolveDiscoveryCreatorMetaLabel from discovery-creator-view-model */
export { resolveDiscoveryCreatorMetaLabel as resolveExactRowCategoriesLabel };

export type DiscoveryCreatorExactRowProps = {
  creator: UnifiedCreatorResult;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenCreator: () => void;
  platformFilter?: string[];
  isApifyAcquired?: boolean;
  workerOfflineHint?: boolean;
  showCampaignRelevance?: boolean;
  className?: string;
  enriching?: boolean;
  selectable?: boolean;
  showFeed?: boolean;
  /** Search workspace — shortlist add state */
  addedToShortlist?: boolean;
  onToggleShortlist?: () => void;
  onReject?: () => void;
  /** Override default search accept/reject actions */
  actions?: ReactNode;
  /** Workspace meta (status, sync, quoted, etc.) between feed and actions */
  meta?: ReactNode;
  /** Row click opens creator detail (Search) or toggles selection (shortlist) */
  rowBehavior?: "open-detail" | "toggle-select";
};

export const DiscoveryCreatorExactRow = memo(function DiscoveryCreatorExactRow({
  creator,
  selected,
  addedToShortlist = false,
  platformFilter,
  isApifyAcquired,
  workerOfflineHint,
  showCampaignRelevance = false,
  onToggleSelect,
  onOpenCreator,
  onToggleShortlist,
  onReject,
  className,
  enriching = false,
  selectable = true,
  showFeed = true,
  actions,
  meta,
  rowBehavior = "open-detail",
}: DiscoveryCreatorExactRowProps) {
  const vm = buildDiscoveryCreatorViewModel(creator, {
    platformFilter,
    isApifyAcquired,
    showCampaignRelevance,
  });

  const stop = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const searchActions =
    actions ??
    (onToggleShortlist || onReject ? (
      <>
        {onToggleShortlist ? (
          <button
            type="button"
            className={cn(
              "discovery-search-exact-accept",
              addedToShortlist && "is-added"
            )}
            onClick={(event) => {
              stop(event);
              onToggleShortlist();
            }}
          >
            <CheckIcon aria-hidden />
            <span>{addedToShortlist ? "Added" : "Add to shortlist"}</span>
          </button>
        ) : null}
        {onReject ? (
          <button
            type="button"
            className="discovery-search-exact-reject"
            aria-label={`Hide ${vm.displayName} from results`}
            onClick={(event) => {
              stop(event);
              onReject();
            }}
          >
            <XIcon aria-hidden />
          </button>
        ) : null}
      </>
    ) : null);

  const handleRowActivate = () => {
    if (rowBehavior === "toggle-select") {
      onToggleSelect();
      return;
    }
    onOpenCreator();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleRowActivate();
        }
      }}
      className={cn(
        "discovery-search-exact-row",
        selected && "is-selected",
        enriching && "discovery-search-exact-row--enriching",
        meta && "discovery-search-exact-row--with-meta",
        className
      )}
    >
      <div className="discovery-search-exact-photo-cell">
        {selectable ? (
          <span className="discovery-search-exact-select" onClick={stop}>
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              aria-label={`${selected ? "Deselect" : "Select"} ${vm.displayName}`}
            />
          </span>
        ) : null}
        <CreatorAvatarHoverTrigger
          creator={creator}
          displayName={vm.displayName}
          avatarUrl={vm.avatarUrl}
          profileUrl={vm.profileUrl}
          thinkwayStarLabel={vm.thinkwayStarLabel}
          fallbackStatusLabel={vm.updatedLabel}
          onOpenCreator={onOpenCreator}
          className="discovery-search-exact-photo-wrap"
        >
          {vm.profileUrl ? (
            <a
              href={vm.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${vm.displayName} profile`}
              className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF]/40"
              onClick={stop}
            >
              <CreatorAvatarImage
                avatarUrl={vm.avatarUrl}
                profileUrl={vm.profileUrl}
                alt={vm.displayName}
                sizeClassName="size-[87px]"
                className="border-0 bg-[var(--surface,#f3f6fc)]"
              />
            </a>
          ) : (
            <CreatorAvatarImage
              avatarUrl={vm.avatarUrl}
              profileUrl={vm.profileUrl}
              alt={vm.displayName}
              sizeClassName="size-[87px]"
              className="border-0 bg-[var(--surface,#f3f6fc)]"
            />
          )}
          {vm.countryFlagCode ? (
            <span className="discovery-search-exact-flag">
              <CountryFlagBadge
                countryCode={vm.countryFlagCode}
                size="md"
                overlay
                className="size-full"
              />
            </span>
          ) : null}
          <span className="discovery-search-exact-star">★ {vm.thinkwayStarLabel}</span>
        </CreatorAvatarHoverTrigger>
      </div>

      <div className="discovery-search-exact-info-cell">
        <div className="discovery-search-exact-info-stack">
          <div className="discovery-search-exact-name" title={vm.displayName}>
            {vm.displayName}
          </div>
          {vm.handleLabel ? (
            <div className="discovery-search-exact-handle" title={vm.handleLabel}>
              {vm.handleLabel}
            </div>
          ) : null}
        </div>
      </div>

      <div className="discovery-search-exact-category-cell">
        <InterestChips interests={vm.categories} emptyLabel="No categories" />
      </div>

      <DiscoveryCreatorPlatformStatsBox platformStats={vm.platformStats} />

      {showFeed ? <DiscoveryCreatorFeedThumbs publications={vm.feedPublications} /> : null}

      {meta ? (
        <div className="discovery-search-exact-meta-cell" onClick={stop}>
          {meta}
        </div>
      ) : null}

      {searchActions ? (
        <div className="discovery-search-exact-actions" onClick={stop}>
          {searchActions}
        </div>
      ) : null}
    </div>
  );
});

/** @deprecated Use DiscoveryCreatorExactRow */
export const CreatorSearchExactRow = DiscoveryCreatorExactRow;
/** @deprecated Use DiscoveryCreatorExactRowProps */
export type CreatorSearchExactRowProps = DiscoveryCreatorExactRowProps;

export function DiscoveryCreatorExactHeader({
  total,
  allSelected,
  hasCreators,
  onToggleSelectAll,
  toolbar,
  metaLabel,
  countLabel,
  showSelectAll = true,
}: {
  total: number;
  allSelected: boolean | "indeterminate";
  hasCreators: boolean;
  onToggleSelectAll: () => void;
  toolbar?: ReactNode;
  metaLabel?: ReactNode;
  countLabel?: string;
  showSelectAll?: boolean;
}) {
  const resolvedCountLabel =
    countLabel ?? `${total.toLocaleString()} Creator${total === 1 ? "" : "s"}`;

  return (
    <div className="discovery-search-exact-headers">
      <div className="discovery-search-exact-col-count">
        {showSelectAll ? (
          <Checkbox
            checked={allSelected}
            onCheckedChange={onToggleSelectAll}
            aria-label="Select all loaded creators"
            disabled={!hasCreators}
          />
        ) : null}
        <span>{resolvedCountLabel}</span>
      </div>
      <span className="discovery-search-exact-col-info">Creator Name</span>
      <span className="discovery-search-exact-col-category">Category</span>
      <span className="discovery-search-exact-col-stats">Statistics</span>
      <div className="discovery-search-exact-col-feed">
        <span>Content from feed</span>
        {toolbar}
      </div>
      {metaLabel ? (
        <span className="discovery-search-exact-col-meta">{metaLabel}</span>
      ) : null}
    </div>
  );
}

/** @deprecated Use DiscoveryCreatorExactHeader */
export const CreatorSearchExactHeader = DiscoveryCreatorExactHeader;
```

#### `features/discovery/components/discovery-interest-chips.tsx`

```tsx
"use client";

import { cn } from "@/lib/utils";

export function InterestChips({
  interests,
  variant = "default",
  maxVisible = 3,
  emptyLabel = "No interests tagged",
}: {
  interests: string[];
  variant?: "default" | "compact";
  maxVisible?: number;
  emptyLabel?: string;
}) {
  if (interests.length === 0) {
    return <span className="text-[11px] text-muted-foreground/60">{emptyLabel}</span>;
  }

  const visible = interests.slice(0, maxVisible);
  const overflow = interests.length - visible.length;

  if (variant === "compact") {
    return (
      <div className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden">
        {visible.map((interest) => (
          <span
            key={interest}
            title={interest}
            className="min-w-0 max-w-[5.5rem] truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
          >
            {interest}
          </span>
        ))}
        {overflow > 0 ? (
          <span
            className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            title={interests.slice(maxVisible).join(", ")}
          >
            +{overflow}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {visible.map((interest) => (
        <span
          key={interest}
          title={interest}
          className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
        >
          {interest}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          title={interests.slice(maxVisible).join(", ")}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

export function RelevanceScore({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }
  const rounded = Math.round(score);
  const bars = Math.max(1, Math.min(4, Math.ceil((rounded / 100) * 4)));
  return (
    <div className="flex items-center gap-1.5" title={`Campaign relevance ${rounded}%`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-0.5 rounded-full", i < bars ? "bg-primary" : "bg-primary/20")}
            style={{ height: `${6 + i * 3}px` }}
          />
        ))}
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-primary">{rounded}</span>
    </div>
  );
}
```

#### `features/discovery/components/discovery-creator-platform-stats.tsx`

```tsx
"use client";

import { creatorRecentPublicationDisplayUrl } from "@/lib/creators/recent-publication-thumb";
import type {
  CreatorRecentPublication,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { PlatformIcon } from "@/lib/performance/platform-icon";

import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import { formatCreatorCount, formatEngagementRate } from "./creator-search/creator-search-utils";

function FeedThumb({ publication }: { publication: CreatorRecentPublication }) {
  const src = creatorRecentPublicationDisplayUrl(publication);
  if (!src) {
    return <div className="discovery-search-exact-feed-thumb discovery-search-exact-feed-thumb--empty" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      className="discovery-search-exact-feed-thumb"
      onError={(event) => {
        event.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

export function DiscoveryCreatorFeedThumbs({
  publications,
}: {
  publications: CreatorRecentPublication[];
}) {
  if (publications.length === 0) {
    return (
      <div className="discovery-search-exact-feed-thumbs discovery-search-exact-feed-thumbs--empty">
        <div className="discovery-search-exact-feed-thumb discovery-search-exact-feed-thumb--empty" />
      </div>
    );
  }

  return (
    <div className="discovery-search-exact-feed-thumbs">
      {publications.map((pub, index) => (
        <FeedThumb key={`${pub.url ?? "pub"}-${index}`} publication={pub} />
      ))}
    </div>
  );
}

export function DiscoveryCreatorPlatformStatsBox({
  creator,
  platformFilter,
  isApifyAcquired,
  platformStats: platformStatsProp,
}: {
  creator?: UnifiedCreatorResult;
  platformFilter?: string[];
  isApifyAcquired?: boolean;
  platformStats?: ReturnType<typeof buildDiscoveryCreatorViewModel>["platformStats"];
}) {
  const platformStats =
    platformStatsProp ??
    (creator
      ? buildDiscoveryCreatorViewModel(creator, { platformFilter, isApifyAcquired }).platformStats
      : []);

  const rows =
    platformStats.length > 0
      ? platformStats
      : [
          {
            key: "empty",
            platform: null as string | null,
            followers: null,
            engagement: null,
            avgViews: null,
          },
        ];

  return (
    <div className="discovery-search-exact-stat-box">
      <div className="discovery-search-exact-stat-head" aria-hidden>
        <span className="discovery-search-exact-stat-platform-logo" />
        <span className="discovery-search-exact-stat-col-label">Followers</span>
        <span className="discovery-search-exact-stat-col-label">Engagement</span>
        <span className="discovery-search-exact-stat-col-label">Avg views</span>
      </div>
      <div className="discovery-search-exact-stat-platforms">
        {rows.map((row) => (
          <div key={row.key} className="discovery-search-exact-stat-platform">
            <div className="discovery-search-exact-stat-platform-logo">
              {row.platform ? (
                <PlatformIcon
                  platform={row.platform}
                  size="xs"
                  variant="logo"
                  className="!size-4"
                />
              ) : null}
            </div>
            <b className="discovery-search-exact-stat-value mono">
              {formatCreatorCount(row.followers)}
            </b>
            <b className="discovery-search-exact-stat-value mono">
              {formatEngagementRate(row.engagement)}
            </b>
            <b className="discovery-search-exact-stat-value mono">
              {formatCreatorCount(row.avgViews)}
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### `features/discovery/components/discovery-creator-profile-summary.tsx`

```tsx
"use client";

import {
  buildDiscoveryCreatorViewModel,
  type DiscoveryCreatorViewModelOptions,
} from "@/features/discovery/view-models/discovery-creator-view-model";
import { useDiscoveryCreatorHoverDetails } from "@/features/discovery/hooks/use-discovery-creator-hover-details";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { CreatorDetailsSummaryCard } from "./creator-details-summary-card";

type Props = {
  creator: UnifiedCreatorResult;
  profileUrl?: string | null;
  size?: "compact" | "sheet";
  className?: string;
  onClick?: () => void;
  viewModelOptions?: DiscoveryCreatorViewModelOptions;
};

/** VM-driven profile header — shared by hover card, detail sheet, and drawer chrome. */
export function DiscoveryCreatorProfileSummary({
  creator,
  profileUrl: profileUrlOverride,
  size = "compact",
  className,
  onClick,
  viewModelOptions,
}: Props) {
  const vm = buildDiscoveryCreatorViewModel(creator, viewModelOptions);
  const { secondaryLine, statusLabel } = useDiscoveryCreatorHoverDetails(creator);

  return (
    <CreatorDetailsSummaryCard
      size={size}
      displayName={vm.displayName}
      avatarUrl={vm.avatarUrl}
      profileUrl={profileUrlOverride ?? vm.profileUrl}
      thinkwayStarLabel={vm.thinkwayStarLabel}
      secondaryLine={secondaryLine}
      statusLabel={statusLabel}
      className={className}
      onClick={onClick}
    />
  );
}
```

#### `features/discovery/components/creator-search/creator-avatar-hover-trigger.tsx`

```tsx
"use client";

import { type MouseEvent, type ReactNode } from "react";

import { useDelayedHover } from "@/lib/hooks/use-delayed-hover";
import { cn } from "@/lib/utils";

import { CreatorDetailsHoverCard } from "./creator-details-hover-card";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

type CreatorAvatarHoverTriggerProps = {
  creator: UnifiedCreatorResult;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  thinkwayStarLabel: string;
  fallbackStatusLabel: string | null;
  onOpenCreator?: () => void;
  children: ReactNode;
  className?: string;
};

export function CreatorAvatarHoverTrigger({
  creator,
  displayName,
  avatarUrl,
  profileUrl,
  thinkwayStarLabel,
  fallbackStatusLabel,
  onOpenCreator,
  children,
  className,
}: CreatorAvatarHoverTriggerProps) {
  const { open, setOpen, onPointerEnter, onPointerLeave, keepOpen, scheduleClose } =
    useDelayedHover(1000);

  const stop = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const openCreatorFromPreview = () => {
    setOpen(false);
    onOpenCreator?.();
  };

  return (
    <div
      className={cn("discovery-creator-avatar-hover-trigger", className)}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onFocus={onPointerEnter}
      onBlur={scheduleClose}
      onClick={stop}
    >
      {children}
      {open ? (
        <div
          className="discovery-creator-avatar-hover-trigger__panel"
          onMouseEnter={keepOpen}
          onMouseLeave={scheduleClose}
        >
          <CreatorDetailsHoverCard
            creator={creator}
            displayName={displayName}
            avatarUrl={avatarUrl}
            profileUrl={profileUrl}
            thinkwayStarLabel={thinkwayStarLabel}
            fallbackStatusLabel={fallbackStatusLabel}
            onClick={onOpenCreator ? openCreatorFromPreview : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
```

#### `features/discovery/components/creator-search/creator-details-hover-card.tsx`

```tsx
"use client";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { DiscoveryCreatorProfileSummary } from "../discovery-creator-profile-summary";

type CreatorDetailsHoverCardProps = {
  creator: UnifiedCreatorResult;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  thinkwayStarLabel: string;
  fallbackStatusLabel: string | null;
  className?: string;
  onClick?: () => void;
};

/** Hover preview card — uses shared VM + hover details hook. */
export function CreatorDetailsHoverCard({
  creator,
  className,
  onClick,
}: CreatorDetailsHoverCardProps) {
  return (
    <DiscoveryCreatorProfileSummary
      creator={creator}
      size="compact"
      className={className}
      onClick={onClick}
    />
  );
}
```


---

## 7 — Bulk selection flyout (base component)

Shared fixed bottom bar. List adapter: `ShortlistSelectionFlyout` (§1). Detail adapter: `ShortlistBulkToolbar` (§2).

#### `features/discovery/components/design-system/discovery-selection-flyout.tsx`

```tsx
"use client";

import { MoreHorizontalIcon, XIcon } from "lucide-react";
import type { LucideIcon } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DiscoverySelectionFlyoutAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost";
};

type DiscoverySelectionFlyoutProps = {
  open: boolean;
  selectedCount: number;
  entityLabel: string;
  actions: DiscoverySelectionFlyoutAction[];
  onClearSelection: () => void;
  onSelectAll?: () => void;
  selectableCount?: number;
  busy?: boolean;
  emptyActionsMessage?: string;
  maxVisibleActions?: number;
};

export const DISCOVERY_SELECTION_FLYOUT_CONTENT_CLASS =
  "pb-[4.5rem] max-md:pb-[4rem]";

export function discoverySelectionFlyoutContentClass(open: boolean, className?: string) {
  return cn(open && DISCOVERY_SELECTION_FLYOUT_CONTENT_CLASS, className);
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function partitionActions(
  actions: DiscoverySelectionFlyoutAction[],
  maxSecondary: number
): {
  primary: DiscoverySelectionFlyoutAction | undefined;
  secondary: DiscoverySelectionFlyoutAction[];
  overflow: DiscoverySelectionFlyoutAction[];
} {
  if (actions.length === 0) {
    return { primary: undefined, secondary: [], overflow: [] };
  }

  const explicitPrimary = actions.find(
    (action) => action.variant === "primary" || action.variant === undefined
  );
  const primary = explicitPrimary ?? actions[0];
  const rest = actions.filter((action) => action.id !== primary.id);

  const secondary: DiscoverySelectionFlyoutAction[] = [];
  const overflow: DiscoverySelectionFlyoutAction[] = [];

  for (const action of rest) {
    if (
      secondary.length < maxSecondary &&
      !action.destructive &&
      (action.variant === "outline" || action.variant === "ghost")
    ) {
      secondary.push(action);
    } else {
      overflow.push(action);
    }
  }

  return { primary, secondary, overflow };
}

function DiscoveryFlyoutDivider() {
  return (
    <div
      className="discovery-selection-flyout__divider mx-0.5 hidden h-5 w-px shrink-0 bg-[rgba(0,87,255,0.14)] sm:block"
      aria-hidden
    />
  );
}

/** Bulk selection flyout — Discovery command-bar chrome (Search, Shortlists). */
export function DiscoverySelectionFlyout({
  open,
  selectedCount,
  entityLabel,
  actions,
  onClearSelection,
  onSelectAll,
  selectableCount,
  busy,
  emptyActionsMessage,
  maxVisibleActions = 2,
}: DiscoverySelectionFlyoutProps) {
  const visible = open && selectedCount > 0;
  const { primary, secondary, overflow } = partitionActions(
    actions,
    Math.max(0, maxVisibleActions - 1)
  );

  const showSelectAll =
    onSelectAll != null &&
    selectableCount != null &&
    selectableCount > 0 &&
    selectedCount < selectableCount;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4",
        "max-md:bottom-4 max-md:pb-[env(safe-area-inset-bottom,0px)]"
      )}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "discovery-selection-flyout pointer-events-auto w-max max-w-[min(calc(100vw-2rem),720px)] transition-all duration-300 ease-out",
          visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        )}
        role="toolbar"
        aria-label="Selection actions"
      >
        <div className="discovery-selection-flyout__bar flex min-w-0 items-center gap-1.5 overflow-x-auto px-2.5 py-2 sm:gap-2 sm:px-3">
          <div className="flex shrink-0 items-center gap-1.5 pr-0.5">
            <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b] dark:text-muted-foreground">
              <span className="tabular-nums text-[#0057FF]">{selectedCount}</span>{" "}
              {pluralize(selectedCount, entityLabel)} selected
            </p>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={busy}
              className="discovery-selection-flyout__clear flex size-7 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(0,87,255,0.14)] dark:border-[rgba(0,87,255,0.24)] bg-white dark:bg-card text-[#64748b] dark:text-muted-foreground transition-colors hover:border-[rgba(0,87,255,0.24)] hover:bg-[rgba(239,246,255,0.95)] dark:hover:bg-primary/10 hover:text-[#0057FF] dark:hover:text-blue-300 disabled:opacity-50"
              aria-label="Clear selection"
            >
              <XIcon className="size-3.5" />
            </button>
            {showSelectAll ? (
              <button
                type="button"
                onClick={onSelectAll}
                disabled={busy}
                className="hidden shrink-0 text-[11px] font-medium text-[#0057FF] hover:text-[#0046cc] sm:inline-flex"
              >
                Select all
              </button>
            ) : null}
          </div>

          {primary || secondary.length > 0 || overflow.length > 0 || emptyActionsMessage ? (
            <>
              <DiscoveryFlyoutDivider />
              <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
                {primary ? (
                  <DiscoveryFlyoutPrimaryButton action={primary} busy={busy} />
                ) : null}
                {secondary.map((action) => (
                  <DiscoveryFlyoutSecondaryButton key={action.id} action={action} busy={busy} />
                ))}
                {overflow.length > 0 ? (
                  <DiscoveryFlyoutOverflowMenu actions={overflow} busy={busy} />
                ) : null}
                {!primary &&
                secondary.length === 0 &&
                overflow.length === 0 &&
                emptyActionsMessage ? (
                  <span className="shrink-0 text-[11px] text-[#64748b] dark:text-muted-foreground">{emptyActionsMessage}</span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DiscoveryFlyoutPrimaryButton({
  action,
  busy,
}: {
  action: DiscoverySelectionFlyoutAction;
  busy?: boolean;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled || busy || action.loading}
      className="creator-detail-sheet-action-btn creator-detail-sheet-action-btn--primary inline-flex h-8 shrink-0 items-center gap-1.5 px-3 text-xs disabled:opacity-50"
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {action.label}
    </button>
  );
}

function DiscoveryFlyoutSecondaryButton({
  action,
  busy,
}: {
  action: DiscoverySelectionFlyoutAction;
  busy?: boolean;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled || busy}
      className="creator-detail-sheet-action-btn inline-flex h-8 shrink-0 items-center gap-1.5 px-2.5 text-xs disabled:opacity-50"
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="hidden sm:inline">{action.label}</span>
    </button>
  );
}

function DiscoveryFlyoutOverflowMenu({
  actions,
  busy,
}: {
  actions: DiscoverySelectionFlyoutAction[];
  busy?: boolean;
}) {
  if (actions.length === 0) return null;

  return (
    <>
      <DiscoveryFlyoutDivider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="creator-detail-sheet-action-btn size-8 shrink-0 px-0 text-[#64748b] hover:text-[#0057FF]"
            disabled={busy}
            aria-label="More actions"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="discovery-selection-flyout-menu min-w-[11.5rem] w-auto rounded-2xl border border-[rgba(0,87,255,0.2)] bg-[linear-gradient(135deg,rgba(239,246,255,0.98)_0%,rgba(255,255,255,0.98)_100%)] p-1.5 shadow-[0_10px_32px_rgba(0,87,255,0.12),0_2px_8px_rgba(15,23,42,0.06)] ring-0"
        >
          <DropdownMenuLabel className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b]">
            More actions
          </DropdownMenuLabel>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={action.id}
                disabled={action.disabled || busy}
                variant={action.destructive ? "destructive" : "default"}
                onClick={action.onClick}
                className="discovery-selection-flyout-menu__item gap-2 rounded-[10px] px-2.5 py-2 text-xs font-medium text-[#334155] focus:bg-[rgba(0,87,255,0.08)] focus:text-[#0057FF] data-[variant=destructive]:focus:bg-red-50 data-[variant=destructive]:focus:text-red-600 [&_svg]:size-3.5 [&_svg]:text-[#64748b] focus:[&_svg]:text-[#0057FF]"
              >
                {Icon ? <Icon aria-hidden /> : null}
                <span className="whitespace-nowrap">{action.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
```


---

## 8 — Row overflow menus

List page: per-row DropdownMenu in shortlists-list.tsx. Detail page: RowActions inline DropdownMenu in shortlist-creator-list.tsx (not DiscoveryCreatorActionsMenu).

#### `features/discovery/components/discovery-creator-actions-menu.tsx`

```tsx
"use client";

import {
  CheckIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  EyeIcon,
  ListPlusIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { DeleteDiscoveryCreatorDialog } from "@/features/discovery/delete-creator/delete-discovery-creator-dialog";
import { isEnrichmentInProgress, resolveCreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";
import { PlatformIcon, PLATFORM_ICON_STYLES } from "@/lib/performance/platform-icon";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { cn } from "@/lib/utils";

/** Extracted from creator_action_menu_light.html / creator_action_menu.html */
const MENU = {
  width: "220px",
  radius: "12px",
  itemPadding: "11px 16px",
  itemGap: "12px",
  iconBadge: { size: "30px", radius: "8px", iconSize: "14px" },
  title: { size: "12px", weight: 600, marginBottom: "1px" },
  subtitle: { size: "10px" },
  trailingIcon: { size: "12px", strokeWidth: 2 },
  checkbox: { size: "16px", radius: "4px", borderWidth: "1.5px" },
  light: {
    bg: "#ffffff",
    border: "#e2e8f0",
    shadow: "0 4px 24px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.05)",
    divider: "#f1f5f9",
    title: "#0f172a",
    subtitle: "#94a3b8",
    trailingStroke: "#cbd5e1",
    checkboxBorder: "#e2e8f0",
    hover: "#f8fafc",
    active: "#f1f5f9",
    badges: {
      viewDetails: { bg: "#eff6ff", icon: "#3b82f6" },
      addToList: { bg: "#ecfdf5", icon: "#10b981" },
      select: { bg: "#fffbeb", icon: "#f59e0b" },
      stopRefresh: { bg: "#fff7ed", icon: "#f97316" },
      refreshMetrics: { bg: "#eff6ff", icon: "#3b82f6" },
      delete: { bg: "#fef2f2", icon: "#ef4444" },
    },
  },
  dark: {
    bg: "#0f1117",
    border: "rgba(255,255,255,0.1)",
    shadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
    divider: "rgba(255,255,255,0.06)",
    title: "#ffffff",
    subtitle: "rgba(255,255,255,0.35)",
    trailingStroke: "rgba(255,255,255,0.25)",
    checkboxBorder: "rgba(255,255,255,0.2)",
    hover: "rgba(255,255,255,0.05)",
    active: "rgba(255,255,255,0.08)",
    badges: {
      viewDetails: { bg: "rgba(99,102,241,0.15)", icon: "#818cf8" },
      addToList: { bg: "rgba(16,185,129,0.15)", icon: "#34d399" },
      select: { bg: "rgba(245,158,11,0.15)", icon: "#fbbf24" },
      stopRefresh: { bg: "rgba(249,115,22,0.15)", icon: "#fb923c" },
      refreshMetrics: { bg: "rgba(99,102,241,0.15)", icon: "#818cf8" },
      delete: { bg: "rgba(239,68,68,0.15)", icon: "#f87171" },
    },
  },
  instagramGradient: "linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)",
} as const;

type MenuBadgeVariant = "viewDetails" | "addToList" | "select" | "stopRefresh" | "refreshMetrics" | "delete";

type DiscoveryActionMenuItemProps = {
  title: string;
  subtitle: ReactNode;
  icon: ReactNode;
  iconStyle?: React.CSSProperties;
  iconClassName?: string;
  trailing?: "external" | "chevron" | "checkbox";
  checked?: boolean;
  showDivider?: boolean;
};

function DiscoveryActionMenuItem({
  title,
  subtitle,
  icon,
  iconStyle,
  iconClassName,
  trailing = "chevron",
  checked = false,
  showDivider = true,
}: DiscoveryActionMenuItemProps) {
  return (
    <span
      className={cn(
        "flex w-full items-center",
        showDivider && "border-b border-[#f1f5f9] dark:border-white/[0.06]"
      )}
      style={{ gap: MENU.itemGap, padding: MENU.itemPadding }}
    >
      <span
        className={cn("flex shrink-0 items-center justify-center", iconClassName)}
        style={{
          width: MENU.iconBadge.size,
          height: MENU.iconBadge.size,
          borderRadius: MENU.iconBadge.radius,
          ...iconStyle,
        }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className="block font-semibold text-[#0f172a] dark:text-white"
          style={{
            fontSize: MENU.title.size,
            marginBottom: MENU.title.marginBottom,
          }}
        >
          {title}
        </span>
        <span
          className="block text-[#94a3b8] dark:text-white/[0.35]"
          style={{ fontSize: MENU.subtitle.size }}
        >
          {subtitle}
        </span>
      </span>
      <span className="flex shrink-0 items-center justify-center">
        {trailing === "external" ? (
          <ExternalLinkIcon
            aria-hidden
            className="text-[#cbd5e1] dark:text-white/25"
            style={{ width: MENU.trailingIcon.size, height: MENU.trailingIcon.size }}
            strokeWidth={MENU.trailingIcon.strokeWidth}
          />
        ) : null}
        {trailing === "chevron" ? (
          <ChevronRightIcon
            aria-hidden
            className="text-[#cbd5e1] dark:text-white/25"
            style={{ width: MENU.trailingIcon.size, height: MENU.trailingIcon.size }}
            strokeWidth={MENU.trailingIcon.strokeWidth}
          />
        ) : null}
        {trailing === "checkbox" ? (
          <span
            aria-hidden
            className={cn(
              "flex shrink-0 items-center justify-center border-[#e2e8f0] dark:border-white/20",
              checked && "border-[#1D9E75] bg-[#1D9E75] text-white"
            )}
            style={{
              width: MENU.checkbox.size,
              height: MENU.checkbox.size,
              borderRadius: MENU.checkbox.radius,
              borderWidth: MENU.checkbox.borderWidth,
            }}
          >
            {checked ? (
              <CheckIcon
                style={{ width: "10px", height: "10px" }}
                strokeWidth={3}
              />
            ) : null}
          </span>
        ) : null}
      </span>
    </span>
  );
}

const menuItemClassName = cn(
  "rounded-none px-0 py-0 text-sm font-normal outline-none transition-colors duration-100",
  "focus:bg-[#f8fafc] data-[highlighted]:bg-[#f8fafc] active:bg-[#f1f5f9]",
  "dark:focus:bg-white/[0.05] dark:data-[highlighted]:bg-white/[0.05] dark:active:bg-white/[0.08]"
);

function InstagramGlyph() {
  return (
    <svg
      aria-hidden
      width={MENU.iconBadge.iconSize}
      height={MENU.iconBadge.iconSize}
      fill="#fff"
      viewBox="0 0 24 24"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function badgeClassName(variant: MenuBadgeVariant): string {
  return cn(
    variant === "viewDetails" && "bg-[#eff6ff] dark:bg-[rgba(99,102,241,0.15)]",
    variant === "addToList" && "bg-[#ecfdf5] dark:bg-[rgba(16,185,129,0.15)]",
    variant === "select" && "bg-[#fffbeb] dark:bg-[rgba(245,158,11,0.15)]",
    variant === "stopRefresh" && "bg-[#fff7ed] dark:bg-[rgba(249,115,22,0.15)]",
    variant === "refreshMetrics" && "bg-[#eff6ff] dark:bg-[rgba(99,102,241,0.15)]",
    variant === "delete" && "bg-[#fef2f2] dark:bg-[rgba(239,68,68,0.15)]"
  );
}

function iconColorClass(variant: MenuBadgeVariant): string {
  return cn(
    variant === "viewDetails" && "text-[#3b82f6] dark:text-[#818cf8]",
    variant === "addToList" && "text-[#10b981] dark:text-[#34d399]",
    variant === "select" && "text-[#f59e0b] dark:text-[#fbbf24]",
    variant === "stopRefresh" && "text-[#f97316] dark:text-[#fb923c]",
    variant === "refreshMetrics" && "text-[#3b82f6] dark:text-[#818cf8]",
    variant === "delete" && "text-[#ef4444] dark:text-[#f87171]"
  );
}

function MenuIcon({
  variant,
  children,
}: {
  variant: MenuBadgeVariant;
  children: ReactNode;
}) {
  return (
    <span
      className={iconColorClass(variant)}
      style={{ width: MENU.iconBadge.iconSize, height: MENU.iconBadge.iconSize }}
    >
      {children}
    </span>
  );
}
function normalizePlatformKey(platform: string): string {
  const value = platform.trim().toLowerCase();
  if (value === "ig") return "instagram";
  if (value === "tt") return "tiktok";
  if (value === "yt") return "youtube";
  if (value === "fb") return "facebook";
  if (value === "sc") return "snapchat";
  return value;
}

function PlatformMenuIcon({ platform }: { platform: string }) {
  const key = normalizePlatformKey(platform);

  if (key === "instagram") {
    return <InstagramGlyph />;
  }

  const style = PLATFORM_ICON_STYLES[key];
  if (style?.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={style.imageUrl}
        alt=""
        style={{ width: MENU.iconBadge.iconSize, height: MENU.iconBadge.iconSize }}
        className="object-contain"
      />
    );
  }

  return <PlatformIcon platform={platform} size="xs" className="size-[14px] rounded-md" />;
}

function platformMenuIconStyle(platform: string): React.CSSProperties {
  const key = normalizePlatformKey(platform);
  if (key === "instagram") {
    return { background: MENU.instagramGradient };
  }
  const style = PLATFORM_ICON_STYLES[key];
  return style ? {} : { background: "#f1f5f9" };
}

function platformMenuIconClassName(platform: string): string {
  const key = normalizePlatformKey(platform);
  if (key === "instagram") return "";
  return PLATFORM_ICON_STYLES[key]?.className ?? "bg-[#f1f5f9] dark:bg-white/10";
}

export type DiscoveryCreatorActionsMenuProps = {
  creator: UnifiedCreatorResult;
  profileUrl: string | null;
  selected: boolean;
  onOpenCreator: () => void;
  onAddToList?: () => void;
  onToggleSelect: () => void;
  onRefreshMetrics?: (platformAccountId?: string | null) => void;
  onStopRefresh?: () => void;
  onCreatorDeleted?: () => void;
  addLabel?: string;
};

export function DiscoveryCreatorActionsMenu({
  creator,
  profileUrl,
  selected,
  onOpenCreator,
  onAddToList,
  onToggleSelect,
  onRefreshMetrics,
  onStopRefresh,
  onCreatorDeleted,
  addLabel = "Add",
}: DiscoveryCreatorActionsMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const platforms = sortPlatformsStable(creator.platforms);
  const metricsPlatform =
    platforms.find((p) => p.id === creator.default_metrics_platform_account_id) ?? platforms[0];
  const enrichmentStatus = resolveCreatorEnrichmentStatus(creator.enrichment_status);
  const refreshInProgress = isEnrichmentInProgress(enrichmentStatus);
  const platformName = metricsPlatform ? platformLabel(metricsPlatform.platform) : "profile";
  const openTitle = metricsPlatform ? `Open on ${platformName}` : "Open profile";

  const menuItems: Array<{
    key: string;
    content: DiscoveryActionMenuItemProps;
    onSelect?: () => void;
    href?: string;
  }> = [];

  if (profileUrl) {
    menuItems.push({
      key: "open-profile",
      href: profileUrl,
      content: {
        title: openTitle,
        subtitle: (
          <>
            <span className="dark:hidden">View creator profile</span>
            <span className="hidden dark:inline">View profile</span>
          </>
        ),
        icon: metricsPlatform ? (
          <PlatformMenuIcon platform={metricsPlatform.platform} />
        ) : (
          <ExternalLinkIcon
            aria-hidden
            className="text-white"
            style={{ width: MENU.iconBadge.iconSize, height: MENU.iconBadge.iconSize }}
            strokeWidth={MENU.trailingIcon.strokeWidth}
          />
        ),
        iconStyle: metricsPlatform
          ? platformMenuIconStyle(metricsPlatform.platform)
          : { background: MENU.instagramGradient },
        iconClassName: metricsPlatform ? platformMenuIconClassName(metricsPlatform.platform) : undefined,
        trailing: "external",
      },
    });
  }

  menuItems.push({
    key: "view-details",
    onSelect: onOpenCreator,
    content: {
      title: "View details",
      subtitle: "Full creator profile",
      icon: (
        <MenuIcon variant="viewDetails">
          <EyeIcon strokeWidth={2} className="size-full" aria-hidden />
        </MenuIcon>
      ),
      iconClassName: badgeClassName("viewDetails"),
      trailing: "chevron",
    },
  });

  if (refreshInProgress && onStopRefresh) {
    menuItems.push({
      key: "stop-refresh",
      onSelect: onStopRefresh,
      content: {
        title: "Stop refresh",
        subtitle:
          enrichmentStatus === "queued"
            ? "Waiting in queue"
            : enrichmentStatus === "running"
              ? "Collecting metrics…"
              : "Cancel in-progress sync",
        icon: (
          <MenuIcon variant="stopRefresh">
            <Loader2Icon strokeWidth={2} className="size-full animate-spin" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("stopRefresh"),
        trailing: "chevron",
      },
    });
  } else if (onRefreshMetrics) {
    menuItems.push({
      key: "refresh-metrics-submenu",
      content: {
        title: "Refresh metrics",
        subtitle: "Update followers & engagement",
        icon: (
          <MenuIcon variant="refreshMetrics">
            <RefreshCwIcon strokeWidth={2} className="size-full" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("refreshMetrics"),
        trailing: "chevron",
      },
    });
  }

  if (onAddToList) {
    menuItems.push({
      key: "add-to-list",
      onSelect: onAddToList,
      content: {
        title: `${addLabel} to list`,
        subtitle: "Save to shortlist",
        icon: (
          <MenuIcon variant="addToList">
            <PlusIcon strokeWidth={2} className="size-full" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("addToList"),
        trailing: "chevron",
      },
    });
  }

  if (creator.influencer_id) {
    menuItems.push({
      key: "delete-creator",
      onSelect: () => setDeleteOpen(true),
      content: {
        title: "Delete from Discovery",
        subtitle: "Remove when not linked to campaigns or lists",
        icon: (
          <MenuIcon variant="delete">
            <Trash2Icon strokeWidth={2} className="size-full" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("delete"),
        trailing: "chevron",
      },
    });
  }

  menuItems.push({
    key: "select",
    onSelect: onToggleSelect,
    content: {
      title: selected ? "Deselect" : "Select",
      subtitle: selected ? "Remove from selection" : "Add to selection",
      icon: (
        <MenuIcon variant="select">
          <CheckIcon strokeWidth={2} className="size-full" aria-hidden />
        </MenuIcon>
      ),
      iconClassName: badgeClassName("select"),
      trailing: "checkbox",
      checked: selected,
    },
  });

  const lastIndex = menuItems.length - 1;

  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {onAddToList ? (
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary lg:inline-flex"
          onClick={onAddToList}
        >
          <ListPlusIcon className="size-3.5" />
          {addLabel}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className={cn(
            "min-w-0 overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-white p-0 ring-0",
            "shadow-[0_4px_24px_rgba(15,23,42,0.08),0_1px_4px_rgba(15,23,42,0.05)]",
            "dark:border-white/10 dark:bg-[#0f1117]",
            "dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)]"
          )}
          style={{ width: MENU.width }}
        >
          {menuItems.map((item, index) => {
            const itemContent = {
              ...item.content,
              showDivider: index < lastIndex,
            };

            if (item.key === "refresh-metrics-submenu" && onRefreshMetrics) {
              return (
                <DropdownMenuSub key={item.key}>
                  <DropdownMenuSubTrigger className={menuItemClassName}>
                    <DiscoveryActionMenuItem {...itemContent} />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[180px] rounded-xl border border-border bg-popover p-1 shadow-lg">
                    {platforms.map((platform) => (
                      <DropdownMenuItem
                        key={platform.id}
                        className="gap-2 rounded-lg text-xs"
                        onSelect={() => onRefreshMetrics(platform.id)}
                      >
                        <PlatformIcon platform={platform.platform} size="xs" className="size-4 rounded-full" />
                        {platformLabel(platform.platform)}
                      </DropdownMenuItem>
                    ))}
                    {platforms.length > 1 ? (
                      <DropdownMenuItem
                        className="gap-2 rounded-lg text-xs font-medium"
                        onSelect={() => onRefreshMetrics(null)}
                      >
                        <RefreshCwIcon className="size-3.5" aria-hidden />
                        Refresh all
                      </DropdownMenuItem>
                    ) : platforms.length === 1 ? (
                      <DropdownMenuItem
                        className="gap-2 rounded-lg text-xs"
                        onSelect={() => onRefreshMetrics(platforms[0]!.id)}
                      >
                        <RefreshCwIcon className="size-3.5" aria-hidden />
                        Refresh
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            }

            if (item.href) {
              return (
                <DropdownMenuItem key={item.key} asChild className={menuItemClassName}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer">
                    <DiscoveryActionMenuItem {...itemContent} />
                  </a>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem
                key={item.key}
                className={menuItemClassName}
                onSelect={item.onSelect}
              >
                <DiscoveryActionMenuItem {...itemContent} />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {creator.influencer_id ? (
        <DeleteDiscoveryCreatorDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          creator={creator}
          onDeleted={onCreatorDeleted}
        />
      ) : null}
    </div>
  );
}
```


---

## 9 — App sidebar (shared shell)

Same sidebar as Search — see DISCOVERY_SEARCH_REFERENCE.md §8 for interaction notes.

#### `app/(dashboard)/layout.tsx`

```tsx
import { Suspense } from "react";

import { DashboardProviders } from "@/components/layout/dashboard-providers";
import { CollapsibleAppSidebar } from "@/components/layout/collapsible-app-sidebar";
import { DashboardSidebarAuth } from "@/components/layout/dashboard-sidebar-auth";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DashboardProviders>
      <div className="relative flex min-h-svh bg-background text-foreground">
        <div className="thinkway-platform-shell flex min-h-svh min-w-0 flex-1 overflow-hidden">
          <Suspense
            fallback={<CollapsibleAppSidebar userEmail={null} />}
          >
            <DashboardSidebarAuth />
          </Suspense>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out">
            {children}
          </div>
        </div>
      </div>
    </DashboardProviders>
  );
}
```

#### `components/layout/collapsible-app-sidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  ArrowRightLeftIcon,
  BarChart3Icon,
  BrainIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChevronRightIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  CoinsIcon,
  FileSignatureIcon,
  FileTextIcon,
  HomeIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  LayersIcon,
  Link2Icon,
  ListIcon,
  MegaphoneIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PercentIcon,
  ReceiptIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldIcon,
  SparklesIcon,
  SendIcon,
  TagsIcon,
  TargetIcon,
  UploadIcon,
  UserCogIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { UserAccount } from "@/components/layout/user-account";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isIntelligenceEnabled } from "@/lib/intelligence/feature-flag";
import {
  APP_SIDEBAR_WIDTH_COLLAPSED,
  APP_SIDEBAR_WIDTH_CSS_VAR,
  APP_SIDEBAR_WIDTH_EXPANDED,
  getAppSidebarLayoutWidth,
  resolveAppSidebarExpanded,
} from "@/lib/layout/app-sidebar-width";
import { cn } from "@/lib/utils";

type NavLinkItem = {
  kind: "link";
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavSubheaderItem = {
  kind: "subheader";
  label: string;
};

type NavEntry = NavLinkItem | NavSubheaderItem;

type NavGroupIconTone = "blue" | "violet" | "teal" | "amber" | "navy";

type NavGroup = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconTone: NavGroupIconTone;
  items: NavEntry[];
};

type NavRailItem = {
  groupLabel: string;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const GROUP_ICON_TONE_CLASS: Record<NavGroupIconTone, string> = {
  blue: "thinkway-sidebar-grp-icon",
  violet: "thinkway-sidebar-grp-icon",
  teal: "thinkway-sidebar-grp-icon",
  amber: "thinkway-sidebar-grp-icon",
  navy: "thinkway-sidebar-grp-icon",
};

/** Global nav order — overview, workspace, commercial, finance, insights, admin. */
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    icon: LayoutDashboardIcon,
    iconTone: "blue",
    items: [
      { kind: "link", href: "/", label: "Home", icon: LayoutDashboardIcon },
      { kind: "link", href: "/dashboard", label: "Executive", icon: LineChartIcon },
    ],
  },
  {
    label: "Workspace",
    icon: MegaphoneIcon,
    iconTone: "violet",
    items: [
      { kind: "link", href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
      { kind: "link", href: "/studio", label: "Studio", icon: LayoutDashboardIcon },
      { kind: "link", href: "/ai", label: "Campaign AI", icon: SparklesIcon },
    ],
  },
  {
    label: "Discovery",
    icon: SearchIcon,
    iconTone: "teal",
    items: [
      { kind: "link", href: "/discovery/search", label: "Search", icon: SearchIcon },
      { kind: "link", href: "/discovery/shortlists", label: "Shortlists", icon: ListIcon },
      {
        kind: "link",
        href: "/discovery/quotations",
        label: "Client Quotations",
        icon: FileTextIcon,
      },
      {
        kind: "link",
        href: "/discovery/campaign-match",
        label: "Campaign Match",
        icon: TargetIcon,
      },
      { kind: "link", href: "/discovery/import", label: "Import Center", icon: UploadIcon },
    ],
  },
  {
    label: "Clients and vendors CRM",
    icon: UsersIcon,
    iconTone: "blue",
    items: [
      { kind: "link", href: "/groups", label: "Holding Groups", icon: LayersIcon },
      { kind: "link", href: "/clients", label: "Clients", icon: Building2Icon },
      { kind: "link", href: "/brands", label: "Brands", icon: SparklesIcon },
      { kind: "link", href: "/vendors", label: "Vendors", icon: UsersIcon },
    ],
  },
  {
    label: "Commercial",
    icon: FileSignatureIcon,
    iconTone: "teal",
    items: [
      { kind: "link", href: "/ios/client", label: "Client IOs", icon: FileSignatureIcon },
      { kind: "link", href: "/ios/vendor", label: "Vendor IOs", icon: FileSignatureIcon },
      { kind: "link", href: "/billing", label: "Billing", icon: ReceiptIcon },
      { kind: "link", href: "/finance/po-tracker", label: "PO Tracker", icon: ReceiptIcon },
    ],
  },
  {
    label: "Finance",
    icon: WalletIcon,
    iconTone: "amber",
    items: [
      { kind: "subheader", label: "Billing & documents" },
      { kind: "link", href: "/finance/invoices", label: "Invoices", icon: FileTextIcon },
      {
        kind: "link",
        href: "/finance/client-credit-notes",
        label: "Client credit notes",
        icon: CircleMinusIcon,
      },
      {
        kind: "link",
        href: "/finance/client-debit-notes",
        label: "Client debit notes",
        icon: CirclePlusIcon,
      },
      {
        kind: "link",
        href: "/finance/vendor-credit-notes",
        label: "Vendor credit notes",
        icon: CircleMinusIcon,
      },
      {
        kind: "link",
        href: "/finance/vendor-debit-notes",
        label: "Vendor debit notes",
        icon: CirclePlusIcon,
      },
      { kind: "subheader", label: "Treasury & cash" },
      { kind: "link", href: "/collections", label: "Collections", icon: CoinsIcon },
      { kind: "link", href: "/treasury", label: "Treasury", icon: WalletIcon },
      { kind: "link", href: "/finance/posting-center", label: "Posting center", icon: SendIcon },
      { kind: "subheader", label: "Compliance & planning" },
      { kind: "link", href: "/finance/vat", label: "VAT & Tax", icon: PercentIcon },
      { kind: "link", href: "/finance/exchange-rates", label: "Exchange rates", icon: RefreshCwIcon },
      { kind: "link", href: "/finance/periods", label: "Periods", icon: CalendarRangeIcon },
      { kind: "link", href: "/planning", label: "Planning", icon: CalendarClockIcon },
      { kind: "subheader", label: "Move from Acc to another" },
      { kind: "link", href: "/operations/move", label: "Move", icon: ArrowRightLeftIcon },
      {
        kind: "link",
        href: "/operations/reassignment",
        label: "Reassignment",
        icon: ArrowRightLeftIcon,
      },
    ],
  },
  {
    label: "Insights",
    icon: BarChart3Icon,
    iconTone: "violet",
    items: [
      { kind: "link", href: "/reports", label: "Reports", icon: BarChart3Icon },
      // Intelligence — gated by INTELLIGENCE_ARCHIVED (see docs/INTELLIGENCE_ARCHIVE.md)
      ...(isIntelligenceEnabled()
        ? [{ kind: "link" as const, href: "/intelligence", label: "Intelligence", icon: BrainIcon }]
        : []),
      { kind: "link", href: "/links", label: "Link Generator", icon: Link2Icon },
    ],
  },
  {
    label: "Administration",
    icon: Settings2Icon,
    iconTone: "navy",
    items: [
      { kind: "link", href: "/settings/users", label: "Users", icon: Settings2Icon },
      { kind: "link", href: "/settings/roles", label: "Roles", icon: UserCogIcon },
      { kind: "link", href: "/settings/permissions", label: "Permissions", icon: ShieldIcon },
      {
        kind: "link",
        href: "/settings/access-control",
        label: "Access Control",
        icon: ShieldIcon,
      },
      { kind: "link", href: "/settings/client-access", label: "Client Access", icon: UsersIcon },
      {
        kind: "link",
        href: "/settings/client-classification-review",
        label: "Classification Review",
        icon: TagsIcon,
      },
      { kind: "link", href: "/settings/email", label: "Email", icon: Settings2Icon },
      { kind: "link", href: "/system/health", label: "System Health", icon: ActivityIcon },
    ],
  },
];

const ALL_GROUP_LABELS = navGroups.map((g) => g.label);
const STORAGE_EXPANDED = "thinkway-sidebar-expanded";
const STORAGE_COLLAPSED_GROUPS = "thinkway-sidebar-collapsed-groups";

const RAIL_PRIMARY_HREF: Record<string, string> = {
  Overview: "/",
  Workspace: "/campaigns",
  Discovery: "/discovery/search",
  "Clients and vendors CRM": "/clients",
  Commercial: "/ios/client",
  Finance: "/finance/invoices",
  Insights: "/reports",
  Administration: "/settings/users",
};

const RAIL_LABEL: Record<string, string> = {
  "Clients and vendors CRM": "Clients & vendors",
};

/** Clearer rail glyphs — aligned to section meaning. */
const RAIL_ICON_OVERRIDE: Partial<
  Record<string, ComponentType<{ className?: string }>>
> = {
  Overview: HomeIcon,
};

/** Legacy section labels from pre-reorg sidebar — map into current groups. */
const LEGACY_COLLAPSED_LABEL_MAP: Record<string, string[]> = {
  Organization: ["Workspace", "Clients and vendors CRM", "Administration"],
  Clients: ["Clients and vendors CRM"],
  Operations: ["Finance"],
  System: ["Administration"],
};

function getNavLinks(group: NavGroup): NavLinkItem[] {
  return group.items.filter((item): item is NavLinkItem => item.kind === "link");
}

function buildNavRailItems(): NavRailItem[] {
  return navGroups.map((group) => ({
    groupLabel: group.label,
    href: RAIL_PRIMARY_HREF[group.label] ?? getNavLinks(group)[0]?.href ?? "/",
    label: RAIL_LABEL[group.label] ?? group.label,
    icon: RAIL_ICON_OVERRIDE[group.label] ?? group.icon,
  }));
}

const navRailItems = buildNavRailItems();

function migrateCollapsedGroups(stored: Set<string>): Set<string> {
  const migrated = new Set<string>();
  let hadLegacy = false;

  for (const label of stored) {
    const mapped = LEGACY_COLLAPSED_LABEL_MAP[label];
    if (mapped) {
      hadLegacy = true;
      for (const next of mapped) migrated.add(next);
    } else if (ALL_GROUP_LABELS.includes(label)) {
      migrated.add(label);
    }
  }

  if (hadLegacy && typeof window !== "undefined") {
    localStorage.setItem(STORAGE_COLLAPSED_GROUPS, JSON.stringify([...migrated]));
  }

  return migrated;
}

type CollapsibleAppSidebarProps = {
  userEmail?: string | null;
};

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isRailItemActive(pathname: string, groupLabel: string): boolean {
  const group = navGroups.find((entry) => entry.label === groupLabel);
  if (!group) return false;
  return getNavLinks(group).some((item) => isItemActive(pathname, item.href));
}

function SidebarRailTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={10}
        className="border-[#e2e8f0] bg-[#111827] px-2.5 py-1.5 text-[12px] font-medium text-white"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function findActiveGroupLabel(pathname: string): string | null {
  for (const group of navGroups) {
    if (getNavLinks(group).some((item) => isItemActive(pathname, item.href))) {
      return group.label;
    }
  }
  return null;
}

function readCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set(ALL_GROUP_LABELS);
  try {
    const raw = localStorage.getItem(STORAGE_COLLAPSED_GROUPS);
    if (!raw) return new Set(ALL_GROUP_LABELS);
    const parsed = JSON.parse(raw) as string[];
    return migrateCollapsedGroups(new Set(parsed));
  } catch {
    return new Set(ALL_GROUP_LABELS);
  }
}

function readSidebarExpanded(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_EXPANDED);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

function initialCollapsedGroups(pathname: string): Set<string> {
  const next = new Set(ALL_GROUP_LABELS);
  const active = findActiveGroupLabel(pathname);
  if (active) next.delete(active);
  return next;
}

export function CollapsibleAppSidebar({ userEmail }: CollapsibleAppSidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    initialCollapsedGroups(pathname)
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setExpanded(readSidebarExpanded());
    const hasStored = localStorage.getItem(STORAGE_COLLAPSED_GROUPS) !== null;
    if (hasStored) {
      const stored = readCollapsedGroups();
      const next = new Set(stored);
      const active = findActiveGroupLabel(pathname);
      if (active) next.delete(active);
      setCollapsedGroups(next);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const activeGroup = findActiveGroupLabel(pathname);
    if (!activeGroup) return;
    setCollapsedGroups((prev) => {
      if (!prev.has(activeGroup)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup);
      localStorage.setItem(
        STORAGE_COLLAPSED_GROUPS,
        JSON.stringify([...next])
      );
      return next;
    });
  }, [pathname, hydrated]);

  const persistExpanded = useCallback((value: boolean) => {
    setExpanded(value);
    localStorage.setItem(STORAGE_EXPANDED, String(value));
  }, []);

  const displayExpanded = resolveAppSidebarExpanded(expanded);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty(
      APP_SIDEBAR_WIDTH_CSS_VAR,
      getAppSidebarLayoutWidth(displayExpanded)
    );
  }, [displayExpanded, hydrated]);

  const sidebarWidth = displayExpanded
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem(STORAGE_COLLAPSED_GROUPS, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const sidebarControlButtonClass =
    "flex size-8 items-center justify-center rounded-lg border-none bg-transparent text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-primary active:scale-95";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="relative hidden shrink-0 self-stretch overflow-hidden transition-all duration-300 ease-in-out md:sticky md:top-0 md:block md:h-full md:max-h-full"
        style={{ width: sidebarWidth }}
      >
        <aside
          className={cn(
            "thinkway-app-sidebar absolute flex flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
            !displayExpanded && "thinkway-app-sidebar--rail"
          )}
          style={{
            left: 0,
            top: 0,
            height: "100%",
            width: sidebarWidth,
          }}
        >
          <div
            className={cn(
              "flex items-center",
              displayExpanded
                ? "gap-3 border-b border-sidebar-border px-5 pb-4 pt-5"
                : "justify-center border-b border-sidebar-border px-2 pb-3 pt-5"
            )}
          >
            <Link href="/" className="min-w-0 shrink-0" title="Thinkway">
              <ThinkwayLogo showText={displayExpanded} compact className="mb-0" />
            </Link>
            {displayExpanded ? (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <span aria-hidden className="h-6 w-px shrink-0 bg-[#e2e8f0] dark:bg-border" />
                <SidebarRailTooltip label="Collapse to icons">
                  <button
                    type="button"
                    onClick={() => persistExpanded(false)}
                    className={sidebarControlButtonClass}
                    aria-label="Collapse to icons"
                  >
                    <PanelLeftCloseIcon className="size-4" />
                  </button>
                </SidebarRailTooltip>
              </div>
            ) : null}
          </div>

          {!displayExpanded ? (
            <nav
              aria-label="Primary"
              className="thinkway-app-sidebar-rail flex flex-1 flex-col items-center gap-2 overflow-y-auto px-2 py-4"
            >
              {navRailItems.map((item) => {
                const active = isRailItemActive(pathname, item.groupLabel);
                const Icon = item.icon;
                return (
                  <SidebarRailTooltip key={item.groupLabel} label={item.label}>
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "thinkway-app-sidebar-rail-link flex size-10 items-center justify-center rounded-lg transition-colors duration-150",
                        active
                          ? "thinkway-app-sidebar-rail-link--active bg-[var(--sidebar-active-bg)] text-primary dark:text-blue-400"
                          : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-primary dark:hover:text-blue-400"
                      )}
                    >
                      <Icon className="size-[18px] shrink-0 stroke-[1.85]" />
                    </Link>
                  </SidebarRailTooltip>
                );
              })}

              <div className="min-h-3 flex-1" aria-hidden />

              <SidebarRailTooltip label="Expand sidebar">
                <button
                  type="button"
                  onClick={() => persistExpanded(true)}
                  className={sidebarControlButtonClass}
                  aria-label="Expand sidebar"
                >
                  <PanelLeftOpenIcon className="size-4" />
                </button>
              </SidebarRailTooltip>
            </nav>
          ) : (
            <nav className="thinkway-app-sidebar-nav flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-3">
              {navGroups.map((group, groupIndex) => {
                const groupCollapsed = collapsedGroups.has(group.label);
                const GroupIcon = group.icon;

                return (
                  <div
                    key={group.label}
                    className={cn(
                      "thinkway-app-sidebar-section flex flex-col",
                      groupIndex > 0 && "mt-3 border-t border-sidebar-border pt-3"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className="thinkway-app-sidebar-section-head flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
                      aria-expanded={!groupCollapsed}
                      aria-label={`${groupCollapsed ? "Expand" : "Collapse"} ${group.label}`}
                    >
                      <span className={GROUP_ICON_TONE_CLASS[group.iconTone]}>
                        <GroupIcon className="size-4 stroke-[1.75] text-sidebar-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[0.08em] text-sidebar-muted-foreground uppercase">
                        {group.label}
                      </span>
                      <ChevronRightIcon
                        className={cn(
                          "size-3.5 shrink-0 text-sidebar-muted-foreground/70 transition-transform duration-200",
                          !groupCollapsed && "rotate-90"
                        )}
                      />
                    </button>

                    <div
                      className={cn(
                        "thinkway-app-sidebar-section-items mt-1 ml-3 flex flex-col border-l border-sidebar-border pl-2",
                        groupCollapsed && "hidden"
                      )}
                    >
                      {group.items.map((item) => {
                        if (item.kind === "subheader") {
                          return (
                            <div
                              key={`subheader-${item.label}`}
                              className="px-2 pt-2.5 pb-1 text-[10px] font-semibold tracking-[0.07em] text-sidebar-muted-foreground uppercase"
                            >
                              {item.label}
                            </div>
                          );
                        }

                        const active = isItemActive(pathname, item.href);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            className={cn(
                              "thinkway-app-sidebar-link flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium transition-colors duration-150",
                              active
                                ? "thinkway-app-sidebar-link--active bg-[var(--sidebar-active-bg)] text-primary dark:text-blue-400"
                                : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                          >
                            <Icon
                              className={cn(
                                "size-4 shrink-0 stroke-[1.75]",
                                active ? "text-primary dark:text-blue-400" : "text-sidebar-muted-foreground"
                              )}
                            />
                            <span
                              className={cn(
                                "truncate",
                                active && "font-semibold text-primary dark:text-blue-400"
                              )}
                            >
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
          )}

          <div
            className={cn(
              "bg-sidebar",
              displayExpanded
                ? "border-t border-sidebar-border px-4 py-3"
                : "flex justify-center border-t border-sidebar-border px-2 pb-4 pt-1"
            )}
          >
            {displayExpanded ? (
              <UserAccount email={userEmail} />
            ) : (
              <UserAccount email={userEmail} compact />
            )}
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
```

#### `components/layout/dashboard-sidebar-auth.tsx`

```tsx
import { CollapsibleAppSidebar } from "@/components/layout/collapsible-app-sidebar";
import { getAuthUser } from "@/lib/supabase/server";

export async function DashboardSidebarAuth() {
  const { user } = await getAuthUser();

  return <CollapsibleAppSidebar userEmail={user?.email ?? null} />;
}
```

#### `lib/layout/app-sidebar-width.ts`

```ts
/** Matches `--rail: 266px` in Thinkway_Client_Form final.html. */
export const APP_SIDEBAR_WIDTH_EXPANDED = "16.625rem";
export const APP_SIDEBAR_WIDTH_COLLAPSED = "4rem";
export const APP_SIDEBAR_WIDTH_HIDDEN = "0px";
export const APP_SIDEBAR_MARGIN = "0px";
export const APP_SIDEBAR_WIDTH_CSS_VAR = "--app-sidebar-width";

/** Full sidebar panel vs icon rail — driven only by user collapse preference. */
export function resolveAppSidebarExpanded(userExpanded: boolean): boolean {
  return userExpanded;
}

/** Sidebar is always visible on desktop (no auto-hide). */
export function resolveAppSidebarVisible(): boolean {
  return true;
}

/** Layout width for main content offset. */
export function getAppSidebarLayoutWidth(displayExpanded: boolean): string {
  const base = displayExpanded
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;
  return `calc(${base} + ${APP_SIDEBAR_MARGIN})`;
}

/** Half of the dashboard main column (viewport minus sidebar). */
export const APP_MAIN_HALF_PANEL_WIDTH = `calc((100vw - var(${APP_SIDEBAR_WIDTH_CSS_VAR}, ${APP_SIDEBAR_WIDTH_COLLAPSED})) / 2)`;
```

#### `lib/hooks/use-delayed-hover.ts`

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DELAY_MS = 2000;
const CLOSE_DELAY_MS = 120;

export function useDelayedHover(delayMs = DEFAULT_DELAY_MS) {
  const [open, setOpen] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const onPointerEnter = useCallback(() => {
    clearCloseTimer();
    clearOpenTimer();
    openTimerRef.current = setTimeout(() => setOpen(true), delayMs);
  }, [clearCloseTimer, clearOpenTimer, delayMs]);

  const onPointerLeave = useCallback(() => {
    clearOpenTimer();
    scheduleClose();
  }, [clearOpenTimer, scheduleClose]);

  const keepOpen = useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [clearCloseTimer, clearOpenTimer]);

  return {
    open,
    setOpen,
    onPointerEnter,
    onPointerLeave,
    keepOpen,
    scheduleClose,
  };
}
```


---

## 10 — Product design tokens

CSS variables referenced by Shortlists list + detail.

#### `app/thinkway-design-tokens.css`

```css
/* ═══════════════════════════════════════════════════════
   THINKWAY DESIGN TOKENS — v1.0 (canonical)
   Source: Thinkway_Brand_Kit.pdf v1.0 + THINKWAY_DESIGN_SPEC.md
   Imported globally via app/globals.css.
   Ref modules alias these names inside scoped roots (.outputs-center-ref, etc.).
   ═══════════════════════════════════════════════════════ */

:root {
  /* ---- Brand ---- */
  --navy: #060810;
  --ink: #0b0f1a;
  --muted: #6b7280;
  --lavender: #e8effe;

  --blue: #0057ff;
  --blue-hover: #0048dd;
  --blue-400: #1a6fff;
  --blue-300: #3d8bff;
  --blue-light: #eef3ff;
  --blue-text: #0048dd;

  --brand-gradient: linear-gradient(145deg, #0040cc, #0057ff, #1a6fff, #0048dd);

  /* ---- Semantic status (not brand) ---- */
  --green: #10b981;
  --green-bg: #ecfdf5;
  --green-text: #065f46;

  --amber: #f59e0b;
  --amber-bg: #fffbeb;
  --amber-text: #92400e;

  --red: #ef4444;
  --red-bg: #fef2f2;
  --red-text: #991b1b;

  --purple: #a855f7;
  --purple-bg: #faf5ff;
  --purple-text: #6b21a8;

  /* ---- Neutral scale ---- */
  --text: var(--ink);
  --text-2: #3f4757;
  --text-3: #6b7280;

  --border: #e3e8f2;
  --surface: #f3f6fc;
  --white: #ffffff;

  /* ---- Shape (HTML mock: 8 / 10 / 16). Prefer --tw-radius / --radius-lg in
     Discovery UI — globals.css overwrites --radius for shadcn (0.75rem). ---- */
  --radius: 8px;
  --radius-md: 10px;
  --radius-lg: 16px;

  /* ---- Motion ---- */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  /*
   * Shadcn-safe aliases — globals.css keeps --muted, --border, and --radius for
   * the legacy platform shell. --brand-gradient is canonical here (do not
   * override in globals). Product UI ref modules should prefer these names
   * when they need official spec values.
   */
  --tw-muted-text: #6b7280;
  --tw-border: #e3e8f2;
  --tw-radius: 8px;
  --tw-brand-gradient: linear-gradient(145deg, #0040cc, #0057ff, #1a6fff, #0048dd);
}

.mono,
.font-mono {
  font-family: var(--font-geist-mono), "Geist Mono", ui-monospace, "SF Mono", Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

/* Product tokens — dark mode (platform-v6, Discovery lists, clients) */
.dark {
  --ink: #fafafa;
  --text: #fafafa;
  --text-2: #d4d4d8;
  --text-3: #a1a1aa;
  --border: rgba(255, 255, 255, 0.08);
  --surface: #141419;
  --white: #18181b;
  --lavender: #0a0a0f;

  --blue-light: rgba(0, 87, 255, 0.12);
  --blue-text: #60a5fa;

  --green-bg: rgba(16, 185, 129, 0.12);
  --green-text: #34d399;

  --amber-bg: rgba(245, 158, 11, 0.12);
  --amber-text: #fbbf24;

  --red-bg: rgba(239, 68, 68, 0.12);
  --red-text: #f87171;

  --purple-bg: rgba(168, 85, 247, 0.12);
  --purple-text: #c084fc;

  --tw-border: rgba(255, 255, 255, 0.08);
  --tw-muted-text: #a1a1aa;
}
```

---

## 11 — CSS extracts (exact-row + selection flyout)

Same classes as Search. Extract from `app/thinkway-platform-v6.css`:

```css
.discovery-search-exact-root {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #fff;
}

.discovery-search-exact-header-bar {
  flex-shrink: 0;
  padding: 16px 40px 0;
  border-bottom: 1px solid #eef0f3;
  background: #fff;
}

.discovery-search-exact-scroll {
  min-height: 0;
  flex: 1;
  overflow: auto;
  overscroll-behavior-y: contain;
  padding: 0 40px 40px;
}

.discovery-search-exact-headers {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 0 14px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  background: #fff;
}

.discovery-search-exact-col-count {
  width: 238px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.discovery-search-exact-col-info {
  width: 190px;
  flex-shrink: 0;
}

.discovery-search-exact-col-category {
  width: 148px;
  flex-shrink: 0;
}

.discovery-search-exact-col-stats {
  width: 260px;
  flex-shrink: 0;
}

.discovery-search-exact-col-feed {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.discovery-search-exact-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-left: auto;
}

.discovery-search-exact-row {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 22px 0;
  border-top: 1px solid #eef0f3;
  cursor: pointer;
  outline: none;
}

.discovery-search-exact-row:hover {
  background: rgba(0, 87, 255, 0.015);
}

.discovery-search-exact-row.is-selected {
  background: rgba(0, 87, 255, 0.04);
}

.discovery-search-exact-row--enriching {
  background: rgba(14, 165, 233, 0.06);
  box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.2);
}

.discovery-search-exact-meta-cell {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 12px;
  width: 220px;
}

.discovery-search-exact-col-meta {
  flex-shrink: 0;
  width: 220px;
  padding: 0 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9ca3af;
}

.discovery-search-exact-row--with-meta .discovery-search-exact-feed-thumbs {
  flex: 0 1 auto;
  min-width: 120px;
  padding-right: 8px;
}

.discovery-search-exact-photo-cell {
  width: 238px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.discovery-search-exact-info-cell {
  width: 190px;
  flex-shrink: 0;
  min-width: 0;
  padding-right: 8px;
  display: flex;
  align-items: center;
}

.discovery-search-exact-info-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  width: 100%;
}

.discovery-search-exact-category-cell {
  width: 148px;
  flex-shrink: 0;
  min-width: 0;
  align-self: center;
  padding-right: 12px;
}

.discovery-search-exact-photo-wrap {
  position: relative;
  flex-shrink: 0;
}

.discovery-creator-avatar-hover-trigger {
  position: relative;
  flex-shrink: 0;
}

.discovery-creator-avatar-hover-trigger__panel {
  position: absolute;
  left: calc(100% + 16px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 60;
  pointer-events: auto;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card {
  gap: 18px;
  min-width: 364px;
  max-width: 442px;
  padding: 16px 18px;
  border-radius: 21px;
  box-shadow:
    0 13px 42px rgba(0, 87, 255, 0.1),
    0 3px 10px rgba(15, 23, 42, 0.06);
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__avatar {
  width: 68px;
  height: 68px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__rating {
  bottom: -8px;
  gap: 4px;
  padding: 3px 9px;
  font-size: 14px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__rating svg {
  width: 14px;
  height: 14px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__title-row {
  gap: 8px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__name {
  font-size: 20px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__sparkle {
  width: 21px;
  height: 21px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__collabs {
  margin-top: 5px;
  font-size: 16px;
}

.discovery-creator-avatar-hover-trigger__panel .discovery-creator-details-hover-card__status {
  margin-top: 3px;
  font-size: 14px;
}

.discovery-selection-flyout__bar {
  border: 1px solid rgba(0, 87, 255, 0.2);
  border-radius: 16px;
  background: linear-gradient(
    135deg,
    rgba(239, 246, 255, 0.98) 0%,
    rgba(255, 255, 255, 0.98) 100%
  );
  box-shadow:
    0 10px 32px rgba(0, 87, 255, 0.1),
    0 2px 8px rgba(15, 23, 42, 0.06);
  scrollbar-width: none;
}

.discovery-selection-flyout__bar::-webkit-scrollbar {
  display: none;
}

.discovery-selection-flyout-menu {
  backdrop-filter: none;
}

.discovery-selection-flyout-menu__item {
  min-height: 2rem;
}

.discovery-selection-flyout-menu__item[data-disabled] {
  color: #94a3b8;
  opacity: 1;
}

.discovery-selection-flyout-menu__item[data-disabled] svg {
  color: #cbd5e1;
}

.discovery-search-exact-photo {
  width: 87px;
  height: 87px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  background: var(--surface, #f3f6fc);
}

.discovery-search-exact-photo--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.discovery-search-exact-flag {
  position: absolute;
  right: -2px;
  bottom: 2px;
  width: 22px;
  height: 22px;
  pointer-events: none;
  z-index: 1;
}

.discovery-search-exact-star {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 700;
  color: var(--amber-text, #92400e);
  background: #fff;
  border: 1px solid var(--border, #e3e8f2);
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.1);
}

.discovery-search-exact-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discovery-search-exact-handle {
  font-size: 11px;
  font-weight: 400;
  line-height: 1.2;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discovery-search-exact-meta {
  font-size: 12.5px;
  color: #6b7280;
  margin-top: 4px;
}

.discovery-search-exact-bio {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.35;
  color: #6b7280;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.discovery-search-exact-country {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: 11px;
  color: #6b7280;
}

.discovery-search-exact-audience,

.discovery-search-exact-dna {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.35;
  color: #6b7280;
}

.discovery-search-exact-platforms {
  margin-top: 4px;
}

.discovery-search-exact-info-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.discovery-search-exact-select {
  flex-shrink: 0;
}

.discovery-search-exact-applied {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

.discovery-search-exact-stat-box {
  border: 1px solid var(--border, #e3e8f2);
  border-radius: 12px;
  padding: 8px 10px;
  width: 260px;
  flex-shrink: 0;
}

.discovery-search-exact-stat-head,

.discovery-search-exact-stat-platform {
  display: grid;
  grid-template-columns: 22px 1fr 1fr 1fr;
  align-items: center;
  column-gap: 8px;
  width: 100%;
}

.discovery-search-exact-stat-head {
  margin-bottom: 4px;
}

.discovery-search-exact-stat-col-label {
  font-size: 10px;
  font-weight: 600;
  color: #9ca3af;
  line-height: 1.2;
}

.discovery-search-exact-stat-platforms {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
}

.discovery-search-exact-stat-platform + .discovery-search-exact-stat-platform {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #eef0f3;
}

.discovery-search-exact-stat-platform-logo {
  width: 22px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink, #0b0f1a);
}

.discovery-search-exact-stat-value {
  display: block;
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.discovery-search-exact-feed-thumbs {
  display: flex;
  gap: 8px;
  flex: 1;
  align-items: center;
  padding: 0 20px;
  min-width: 0;
}

.discovery-search-exact-feed-thumbs--empty {
  min-height: 56px;
}

.discovery-search-exact-feed-empty {
  font-size: 11px;
  color: #9ca3af;
}

.discovery-search-exact-feed-thumb {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  flex-shrink: 0;
  object-fit: cover;
  background: var(--surface, #f3f6fc);
}

.discovery-search-exact-feed-thumb--empty {
  background: #eef1f6;
  border: 1px solid var(--border, #e3e8f2);
}

.discovery-search-exact-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.discovery-search-exact-accept {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border-radius: 9px;
  background: var(--blue, #0057ff);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 120ms;
  white-space: nowrap;
}

.discovery-search-exact-accept:hover {
  filter: brightness(1.05);
}

.discovery-search-exact-accept.is-added {
  background: #10b981;
}

.discovery-search-exact-accept.is-added:hover {
  filter: brightness(1.05);
}

.discovery-search-exact-accept svg {
  width: 11px;
  height: 11px;
}

.discovery-search-exact-reject {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  border: 1.5px solid var(--border, #e3e8f2);
  color: #1f2937;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  cursor: pointer;
}

.discovery-search-exact-reject svg {
  width: 13px;
  height: 13px;
}

.discovery-search-exact-row-menu {
  border-radius: 10px;
  border: 1px solid var(--border, #e3e8f2);
  background: #fff;
}

.discovery-search-exact-reject:hover {
  border-color: #fca5a5;
  color: #dc2626;
}
```

### `app/globals.css` — sidebar (lines 250–330)

```css
   */
  table:not([data-slot="table"]) th {
    @apply bg-muted/60 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase;
  }

  .thinkway-shell-header {
    @apply border-b border-border bg-background/80 backdrop-blur-md;
  }

  .thinkway-workspace-chrome {
    @apply border-b border-border bg-background/90 backdrop-blur-md;
  }

  /* Platform shell — flush edges, soft top-left curve */
  .thinkway-platform-shell {
    border-top-left-radius: 48px;
    background: #ffffff;
    box-shadow:
      0 0 0 1px rgba(0, 87, 255, 0.04),
      0 20px 48px rgba(0, 87, 255, 0.08);
  }

  .thinkway-app-sidebar {
    box-shadow: 1px 0 0 rgba(238, 240, 243, 0.95);
  }

  .dark .thinkway-app-sidebar {
    box-shadow: 1px 0 0 var(--border);
  }

  .thinkway-app-sidebar-link--active {
    font-weight: 600;
  }

  .thinkway-app-sidebar--rail {
    box-shadow: none;
  }

  .thinkway-app-sidebar-rail-link--active {
    box-shadow: inset 0 0 0 1px rgba(0, 87, 255, 0.08);
  }

  /* Sidebar logo — readable on dark elevated rail */
  .dark .login-v2-logo-text {
    color: #fafafa;
  }

  .dark .login-v2-logo-text span {
    color: #0057ff;
  }

  .dark .thinkway-platform-shell {
    background: var(--surface-elevated);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.04),
      0 20px 48px rgba(0, 0, 0, 0.35);
  }

  .dark .thinkway-app-sidebar {
    background: var(--sidebar);
    border-color: var(--sidebar-border);
    color: var(--sidebar-foreground);
  }

  .thinkway-sidebar-grp-icon {
    @apply flex size-[18px] shrink-0 items-center justify-center text-sidebar-muted-foreground;
  }

  .dark .thinkway-sidebar-grp-icon {
    @apply text-sidebar-muted-foreground;
  }

  .dark .thinkway-app-sidebar .login-v2-logo-mark {
    background: rgba(0, 87, 255, 0.18);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  }

}

@media (max-width: 767px) {
  :root {
```

---

*End of DISCOVERY SHORTLISTS reference handoff.*
