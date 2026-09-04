"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  buildListNavFilterKey,
  writeListNavContext,
} from "@/lib/navigation/list-nav-context";
import { cn } from "@/lib/utils";
import { D, ini } from "@/lib/discovery/suite";

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
  ShortlistSelectionFlyout,
  shortlistListFloatingBarContentClass,
} from "./shortlist-selection-flyout";
import { CreateShortlistDialog } from "./create-shortlist-dialog";
import {
  shortlistDetailPath,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";
import { ClientWorkspaceListLinkCell } from "@/features/client-workspace/components/client-workspace-list-link-cell";
import {
  DiscoveryFilteredEmptyState,
  DiscoverySuiteCell,
  DiscoverySuiteGrid,
  DiscoverySuiteMasthead,
  DiscoverySuiteRow,
} from "@/features/discovery/components/design-system";
import { DISCOVERY_COLS } from "@/features/discovery/components/design-system/discovery-suite-cols";
import { ShortlistListFilterBar } from "./shortlist-list-filter-bar";

/** Pack track list — byte-identical (01-shortlists.md). */
const SHORTLISTS_COLS = DISCOVERY_COLS.shortlists;
const SHORTLISTS_MIN_W = 1250;

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

function ownerTone(index: number): "k1" | "k2" | "k3" | "k4" {
  const n = (index % 4) + 1;
  if (n === 1) return "k1";
  if (n === 2) return "k2";
  if (n === 3) return "k3";
  return "k4";
}

export function ShortlistsList({ shortlists, brands = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<ShortlistListFilterState>(
    DEFAULT_SHORTLIST_LIST_FILTERS
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    () => filteredShortlists.reduce((sum, row) => sum + row.creator_count, 0),
    [filteredShortlists]
  );

  const portfolioCreatorCount = useMemo(
    () => shortlists.reduce((sum, row) => sum + row.creator_count, 0),
    [shortlists]
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

  const runBulkAction = useCallback(
    (def: ShortlistListActionDef) => {
      startTransition(async () => {
        let updated = 0;
        let skipped = 0;
        let lastError: string | undefined;

        for (const row of selectedRows) {
          if (!def.show(row.status)) {
            skipped += 1;
            continue;
          }
          try {
            const result = await LIST_ACTION_RUNNERS[def.key](row.id);
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

  const showFloatingBar = selectedCount > 0;
  const cardSubtitle = `${shortlists.length} total · newest first`;

  const header = (
    <>
      <DiscoverySuiteCell>
        <input
          type="checkbox"
          className="tw-ck"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = indeterminate && !allSelected;
          }}
          onChange={(event) =>
            setSelectedIds((prev) =>
              toggleSelectAll(visibleIds, prev, event.target.checked)
            )
          }
          aria-label="Select all"
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
      <DiscoverySuiteCell className="tw-rr" align="end">
        Creators
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>Updated</DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Act
      </DiscoverySuiteCell>
    </>
  );

  const footer = (
    <>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell>
        {filteredShortlists.length} of {shortlists.length} shown
      </DiscoverySuiteCell>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell className="tw-v" align="end">
        {filteredCreatorCount} of {portfolioCreatorCount}
      </DiscoverySuiteCell>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
    </>
  );

  return (
    <div className="discovery-suite flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--tw-bg)]">
      <div className="shrink-0 px-[22px] pt-[18px]">
        <DiscoverySuiteMasthead
          title="Shortlists"
          subtitle="Build, review, approve and move creators into campaigns"
          metrics={mastheadMetrics}
          freezeOnScroll={false}
        />
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-[22px] pb-10",
          shortlistListFloatingBarContentClass(showFloatingBar)
        )}
      >
        <div className="tw-c">
          <div className="tw-ch">
            <span className="tw-ct">Shortlists</span>
            <span className="tw-cs">{cardSubtitle}</span>
            <span className="tw-sp" />
            <span className="tw-search" style={{ flex: "0 0 220px" }}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4.3-4.3" />
              </svg>
              <input
                className="tw-in"
                placeholder="Search shortlists…"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, search: event.target.value }))
                }
              />
            </span>
            <button
              type="button"
              className="tw-b sm"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              Filter
            </button>
            <button type="button" className="tw-b sm">
              Sort
            </button>
            <CreateShortlistDialog brands={brands} />
          </div>

          {filtersOpen ? (
            <div className="border-b border-[var(--tw-line)] px-[15px] py-2">
              <ShortlistListFilterBar
                filters={filters}
                onChange={setFilters}
                brands={brands}
                resultCount={filteredShortlists.length}
                totalCount={shortlists.length}
                inline
              />
            </div>
          ) : null}

          {filteredShortlists.length === 0 ? (
            <DiscoveryFilteredEmptyState
              title="No shortlists match your filters"
              onReset={() => setFilters(DEFAULT_SHORTLIST_LIST_FILTERS)}
              className="m-4"
            />
          ) : (
            <DiscoverySuiteGrid
              cols={SHORTLISTS_COLS}
              minWidth={SHORTLISTS_MIN_W}
              framed={false}
              header={header}
              footer={footer}
            >
              {filteredShortlists.map((row, index) => {
                const serial = row.serial_number ?? row.id;
                const isSelected = effectiveSelectedIds.has(row.id);
                const brand = row.brand_name?.trim() ?? "";
                const ownerLabel = row.owner_name ?? "—";
                const statusLabel = SHORTLIST_STATUS_LABELS[row.status];
                const visibilityLabel = SHORTLIST_VISIBILITY_LABELS[row.visibility];

                return (
                  <DiscoverySuiteRow key={row.id} selected={isSelected}>
                    <DiscoverySuiteCell>
                      <input
                        type="checkbox"
                        className="tw-ck"
                        checked={isSelected}
                        onChange={(event) =>
                          setSelectedIds((prev) =>
                            toggleItemSelection(prev, row.id, event.target.checked)
                          )
                        }
                        aria-label={`Select ${serial}`}
                        disabled={isPending}
                      />
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className="tw-id">{serial}</DiscoverySuiteCell>
                    <DiscoverySuiteCell>
                      <Link href={shortlistDetailPath(row)} className="tw-nm">
                        {row.name}
                      </Link>
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className={brand ? "tw-br" : "tw-miss"}>
                      {brand || "not set"}
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell>
                      <span
                        className={cn(
                          "tw-p",
                          row.status === "approved" ? "p-g" : "p-n"
                        )}
                      >
                        {statusLabel}
                      </span>
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell>
                      <ClientWorkspaceListLinkCell
                        source="shortlist"
                        id={row.id}
                        link={row.client_workspace_link}
                      />
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell>
                      <span className="tw-p p-b">{visibilityLabel}</span>
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell>
                      <span className="tw-cw2" style={{ gap: 7 }}>
                        <span
                          className={cn("tw-av", ownerTone(index))}
                          style={{ width: 22, height: 22, fontSize: 9 }}
                        >
                          {ini(ownerLabel).slice(0, 1)}
                        </span>
                        <span className="tw-t">{ownerLabel}</span>
                      </span>
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className="tw-v" align="end">
                      {row.creator_count}
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className="tw-d">
                      {D(row.updated_at) || (
                        <span className="tw-miss">not set</span>
                      )}
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className="tw-act" align="end">
                      <Link href={shortlistDetailPath(row)} className="tw-b sm">
                        Open
                      </Link>
                    </DiscoverySuiteCell>
                  </DiscoverySuiteRow>
                );
              })}
            </DiscoverySuiteGrid>
          )}
        </div>
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
