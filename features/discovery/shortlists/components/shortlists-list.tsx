"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

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
  ShortlistListStatusPill,
  ShortlistListVisibilityPill,
} from "./shortlist-badges";
import {
  ShortlistSelectionFlyout,
  shortlistListFloatingBarContentClass,
} from "./shortlist-selection-flyout";
import { ShortlistsListMergedHeader } from "./shortlists-list-header";
import { shortlistDetailPath } from "../constants";
import {
  InitialsAvatar,
  ShortlistCreatorPreviewStack,
} from "./shortlist-row-visuals";

import {
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

const TABLE_GUTTER_START = "pl-8";
const TABLE_GUTTER_END = "pr-8";
const SHORTLIST_LIST_HEAD_CLASS =
  "h-auto bg-transparent px-4 py-[13px] text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground";
const SHORTLIST_LIST_CELL_CLASS =
  "border-t border-border px-4 py-3.5 align-middle text-[13px] text-[var(--text-2)]";
const SHORTLIST_LIST_ROW_CLASS = "group transition-colors hover:bg-muted/20";

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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ShortlistsListMergedHeader
        filters={filters}
        onChange={setFilters}
        brands={brands}
        resultCount={filteredShortlists.length}
        totalCount={shortlists.length}
      />

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain",
          shortlistListFloatingBarContentClass(showFloatingBar)
        )}
      >
        {filteredShortlists.length === 0 ? (
          <DiscoveryFilteredEmptyState
            title="No shortlists match your filters"
            onReset={() => setFilters(DEFAULT_SHORTLIST_LIST_FILTERS)}
            className="mx-8"
          />
        ) : (
          <Table variant="flush">
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className={cn(SHORTLIST_LIST_HEAD_CLASS, TABLE_GUTTER_START, "w-[34px]")}>
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
                <TableHead className={SHORTLIST_LIST_HEAD_CLASS}>Serial</TableHead>
                <TableHead className={SHORTLIST_LIST_HEAD_CLASS}>Shortlist</TableHead>
                <TableHead className={SHORTLIST_LIST_HEAD_CLASS}>Status</TableHead>
                <TableHead className={SHORTLIST_LIST_HEAD_CLASS}>Visibility</TableHead>
                <TableHead className={SHORTLIST_LIST_HEAD_CLASS}>Owner</TableHead>
                <TableHead className={SHORTLIST_LIST_HEAD_CLASS}>Creators</TableHead>
                <TableHead className={SHORTLIST_LIST_HEAD_CLASS}>Updated</TableHead>
                <TableHead className={cn(SHORTLIST_LIST_HEAD_CLASS, TABLE_GUTTER_END, "w-12")} />
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
                    className={SHORTLIST_LIST_ROW_CLASS}
                  >
                    <TableCell className={cn(SHORTLIST_LIST_CELL_CLASS, TABLE_GUTTER_START, "w-[34px]")}>
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
                        SHORTLIST_LIST_CELL_CLASS,
                        "tabular-nums text-[12px] font-bold text-[var(--text)]"
                      )}
                    >
                      {row.serial_number ?? "—"}
                    </TableCell>
                    <TableCell className={SHORTLIST_LIST_CELL_CLASS}>
                      <div className="flex min-w-0 items-center gap-[11px]">
                        <InitialsAvatar
                          name={row.name}
                          seed={row.id}
                          sizeClass="size-8 text-[11px]"
                        />
                        <div className="min-w-0">
                          <Link
                            href={shortlistDetailPath(row)}
                            className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)] transition-colors group-hover:text-[var(--blue-text)]"
                          >
                            {row.name}
                          </Link>
                          {row.brand_name ? (
                            <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                              {row.brand_name}
                              {row.client_name ? ` · ${row.client_name}` : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={SHORTLIST_LIST_CELL_CLASS}>
                      <ShortlistListStatusPill status={row.status} />
                    </TableCell>
                    <TableCell className={SHORTLIST_LIST_CELL_CLASS}>
                      <ShortlistListVisibilityPill visibility={row.visibility} />
                    </TableCell>
                    <TableCell className={SHORTLIST_LIST_CELL_CLASS}>
                      <div className="flex min-w-0 items-center gap-[9px]">
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
                    <TableCell className={SHORTLIST_LIST_CELL_CLASS}>
                      <ShortlistCreatorPreviewStack
                        previews={row.creator_previews}
                        totalCount={row.creator_count}
                        align="start"
                        overflowVariant="solid"
                      />
                    </TableCell>
                    <TableCell className={cn(SHORTLIST_LIST_CELL_CLASS, "text-[12.5px] tabular-nums text-muted-foreground")}>
                      {row.updated_at
                        ? format(new Date(row.updated_at), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className={cn(SHORTLIST_LIST_CELL_CLASS, TABLE_GUTTER_END, "w-12")}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={isPending}
                            aria-label="Shortlist actions"
                            className="inline-flex size-[30px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:scale-[0.94] disabled:opacity-50"
                          >
                            <MoreHorizontalIcon className="size-[18px]" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={shortlistDetailPath(row)}>Open</Link>
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
        <div className="h-10 shrink-0" aria-hidden />
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
