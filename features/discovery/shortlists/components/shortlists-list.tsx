"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import {
  buildListNavFilterKey,
  writeListNavContext,
} from "@/lib/navigation/list-nav-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDiscoveryDate } from "@/lib/discovery/format-discovery-date";

import {
  approveShortlist,
  archiveShortlist,
  cancelShortlist,
  duplicateShortlist,
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
import { ClientWorkspaceListLinkCell } from "@/features/client-workspace/components/client-workspace-list-link-cell";
import {
  InitialsAvatar,
  ShortlistCreatorPreviewStack,
} from "./shortlist-row-visuals";

import {
  DiscoveryFilteredEmptyState,
  DiscoverySuiteCell,
  DiscoverySuiteGrid,
  DiscoverySuiteMasthead,
  DiscoverySuiteRow,
} from "@/features/discovery/components/design-system";

const LIST_ACTION_RUNNERS: Record<
  ShortlistListActionKey,
  (id: string) => Promise<{
    ok: boolean;
    message?: string;
    id?: string;
    serial_number?: string | null;
  }>
> = {
  submit_for_review: submitShortlistForReview,
  approve: approveShortlist,
  return_to_draft: rejectShortlist,
  reopen: reopenShortlist,
  cancel: cancelShortlist,
  archive: archiveShortlist,
  duplicate: duplicateShortlist,
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

  const mastheadMetrics = useMemo(() => {
    const draftCount = shortlists.filter((row) => row.status === "draft").length;
    const approvedCount = shortlists.filter((row) => row.status === "approved").length;
    const creatorCount = shortlists.reduce((sum, row) => sum + row.creator_count, 0);
    const clientLinkOnCount = shortlists.filter(
      (row) => row.client_workspace_link?.state === "active"
    ).length;
    const privateCount = shortlists.filter((row) => row.visibility === "private").length;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const updatedToday = shortlists.filter(
      (row) => new Date(row.updated_at).getTime() >= startOfDay.getTime()
    ).length;

    return [
      shortlists.length > 0
        ? { label: "Shortlists", value: shortlists.length }
        : null,
      draftCount > 0 ? { label: "Draft", value: draftCount } : null,
      approvedCount > 0
        ? { label: "Approved", value: approvedCount, tone: "g" as const }
        : null,
      creatorCount > 0 ? { label: "Creators", value: creatorCount } : null,
      clientLinkOnCount > 0
        ? { label: "Client link on", value: clientLinkOnCount, tone: "g" as const }
        : null,
      privateCount > 0 ? { label: "Private", value: privateCount } : null,
      updatedToday > 0 ? { label: "Updated today", value: updatedToday } : null,
    ].filter((metric): metric is NonNullable<typeof metric> => metric !== null);
  }, [shortlists]);

  const filteredCreatorCount = useMemo(
    () =>
      filteredShortlists.reduce((sum, row) => sum + row.creator_count, 0),
    [filteredShortlists]
  );

  const visibleIds = useMemo(
    () => filteredShortlists.map((row) => row.id),
    [filteredShortlists]
  );

  useEffect(() => {
    writeListNavContext("shortlists", {
      ids: visibleIds,
      filterKey: buildListNavFilterKey(filters as unknown as Record<string, unknown>),
    });
  }, [filters, visibleIds]);

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

  const runRowAction = useCallback(
    (row: ShortlistListRow, def: ShortlistListActionDef) => {
      startTransition(async () => {
        try {
          const result = await LIST_ACTION_RUNNERS[def.key](row.id);
          if (!result.ok) {
            toast.error(result.message ?? "Action failed");
            return;
          }
          toast.success(result.message ?? "Done");
          if (def.key === "duplicate" && result.id) {
            router.push(
              shortlistDetailPath({ id: result.id, serial_number: result.serial_number })
            );
            return;
          }
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Action failed");
        }
      });
    },
    [router]
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
            def.key === "duplicate"
              ? `${updated} shortlist${updated === 1 ? "" : "s"} duplicated.` +
                (skipped > 0 ? ` ${skipped} skipped.` : "")
              : `${updated} shortlist${updated === 1 ? "" : "s"} ${def.label.toLowerCase()}.` +
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
    <div className="discovery-suite flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--tw-bg)]">
      <div className="shrink-0 px-4 pt-4">
        <DiscoverySuiteMasthead
          title="Shortlists"
          subtitle="Build, review, approve and move creators into campaigns"
          metrics={mastheadMetrics}
          freezeOnScroll={false}
        />
      </div>

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
          <DiscoverySuiteGrid
            cols="shortlists"
            className="mx-4 mt-4"
            header={
              <>
                <DiscoverySuiteCell>
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
                </DiscoverySuiteCell>
                <DiscoverySuiteCell>Serial</DiscoverySuiteCell>
                <DiscoverySuiteCell>Shortlist</DiscoverySuiteCell>
                <DiscoverySuiteCell>Brand</DiscoverySuiteCell>
                <DiscoverySuiteCell>Status</DiscoverySuiteCell>
                <DiscoverySuiteCell>Client link</DiscoverySuiteCell>
                <DiscoverySuiteCell>Visibility</DiscoverySuiteCell>
                <DiscoverySuiteCell>Owner</DiscoverySuiteCell>
                <DiscoverySuiteCell align="end">Creators</DiscoverySuiteCell>
                <DiscoverySuiteCell>Updated</DiscoverySuiteCell>
                <DiscoverySuiteCell>Act</DiscoverySuiteCell>
              </>
            }
            footer={
              <>
                <div className="col-span-8" role="gridcell">
                  {filteredShortlists.length} of {shortlists.length} shown
                </div>
                <DiscoverySuiteCell className="tw-v" align="end">
                  {filteredCreatorCount} creators
                </DiscoverySuiteCell>
                <div className="col-span-2" role="gridcell" />
              </>
            }
          >
              {filteredShortlists.map((row) => {
                const actions = actionsFor(row);
                const ownerLabel = row.owner_name ?? "Unknown";
                const isSelected = effectiveSelectedIds.has(row.id);

                return (
                  <DiscoverySuiteRow
                    key={row.id}
                    selected={isSelected}
                    className="group"
                  >
                    <DiscoverySuiteCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(value) =>
                          setSelectedIds((prev) =>
                            toggleItemSelection(prev, row.id, Boolean(value))
                          )
                        }
                        aria-label={`Select ${row.serial_number ?? row.name}`}
                        disabled={isPending}
                      />
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className="tw-id">
                      {row.serial_number ?? "—"}
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell>
                      <div className="flex min-w-0 items-center gap-[11px]">
                        <InitialsAvatar
                          name={row.name}
                          seed={row.id}
                          sizeClass="size-8 text-[11px]"
                        />
                        <div className="min-w-0">
                          <Link
                            href={shortlistDetailPath(row)}
                            className="tw-nm block transition-colors group-hover:text-[var(--tw-blue)]"
                          >
                            {row.name}
                          </Link>
                          {row.client_name ? (
                            <span className="tw-s">
                              {row.client_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className="tw-br">
                      {row.brand_name ?? <span className="tw-miss">not set</span>}
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell>
                      <ShortlistListStatusPill status={row.status} />
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className="overflow-visible whitespace-normal">
                      <ClientWorkspaceListLinkCell
                        source="shortlist"
                        id={row.id}
                        link={row.client_workspace_link}
                      />
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell>
                      <ShortlistListVisibilityPill visibility={row.visibility} />
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell>
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
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell align="end">
                      <ShortlistCreatorPreviewStack
                        previews={row.creator_previews}
                        totalCount={row.creator_count}
                        align="end"
                        overflowVariant="solid"
                      />
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className="tw-d">
                      {formatDiscoveryDate(row.updated_at) || (
                        <span className="tw-miss">not set</span>
                      )}
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell align="end" className="tw-act">
                      <Link
                        href={shortlistDetailPath(row)}
                        className="tw-b sm inline-flex h-[27px] items-center rounded-[8px] border border-[#E3E8F2] bg-white px-2.5 text-[11.5px] font-semibold text-[var(--tw-ink2)] hover:border-[rgba(0,87,255,.35)] hover:text-[var(--tw-bi)]"
                      >
                        Open
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={isPending}
                            aria-label="More shortlist actions"
                            className="tw-x ml-1 inline-flex size-[27px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault();
                              runRowAction(row, {
                                key: "duplicate",
                                label: "Duplicate",
                                show: () => true,
                              });
                            }}
                          >
                            Duplicate
                          </DropdownMenuItem>
                          {actions.filter((action) => action.key !== "duplicate").length > 0 ? (
                            <DropdownMenuSeparator />
                          ) : null}
                          {actions
                            .filter((action) => action.key !== "duplicate")
                            .map((action) => (
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
                    </DiscoverySuiteCell>
                  </DiscoverySuiteRow>
                );
              })}
          </DiscoverySuiteGrid>
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
