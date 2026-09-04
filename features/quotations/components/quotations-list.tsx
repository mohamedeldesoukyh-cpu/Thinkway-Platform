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
import { AB, F, ini } from "@/lib/discovery/suite/helpers";

import {
  countSelected,
  isAllVisibleSelected,
  isIndeterminateSelection,
  pruneSelection,
  toggleItemSelection,
  toggleSelectAll,
} from "@/features/discovery/shortlists/bulk-selection-policy";
import { CreateQuotationDialog } from "@/features/quotations/components/create-quotation-dialog";
import { ClientWorkspaceListLinkCell } from "@/features/client-workspace/components/client-workspace-list-link-cell";
import {
  DiscoveryFilteredEmptyState,
  DiscoverySuiteCell,
  DiscoverySuiteGrid,
  DiscoverySuiteMasthead,
  DiscoverySuiteRow,
} from "@/features/discovery/components/design-system";
import { DISCOVERY_GRID_MIN_W } from "@/features/discovery/components/design-system/discovery-suite-cols";

import { archiveQuotation } from "../actions";
import { quotationDetailPath, QUOTATION_STATUS_LABELS } from "../constants";
import {
  resolveBulkQuotationActions,
  type QuotationListActionDef,
  type QuotationListActionKey,
} from "../quotation-list-actions";
import {
  DEFAULT_QUOTATION_LIST_FILTERS,
  filterQuotationRows,
  type QuotationListFilterState,
} from "../quotation-list-filters";
import type { QuotationFormOptions, QuotationListRow } from "../types";
import {
  QuotationSelectionFlyout,
  quotationListFloatingBarContentClass,
} from "./quotation-selection-flyout";
import { QuotationListFilterBar } from "./quotation-list-filter-bar";

/** Pack min-width — 03-quotations.md `grid(C, 1300, …)`. */
const QUOTATIONS_MIN_W = DISCOVERY_GRID_MIN_W.quotations ?? 1300;

const LIST_ACTION_RUNNERS: Record<
  QuotationListActionKey,
  (id: string) => Promise<{ ok: boolean; message?: string }>
> = {
  archive: archiveQuotation,
};

type Props = {
  quotations: QuotationListRow[];
  brands?: Array<{
    id: string;
    name: string;
    client_name?: string | null;
  }>;
  formOptions: QuotationFormOptions;
};

function ownerTone(index: number): "k1" | "k2" | "k3" | "k4" {
  const n = (index % 4) + 1;
  if (n === 1) return "k1";
  if (n === 2) return "k2";
  if (n === 3) return "k3";
  return "k4";
}

function uniqueCreatorCount(rows: QuotationListRow[]): number {
  const names = new Set<string>();
  for (const row of rows) {
    for (const preview of row.creator_previews) {
      const key = preview.display_name.trim().toLowerCase();
      if (key) names.add(key);
    }
  }
  return names.size;
}

export function QuotationsList({ quotations, brands = [], formOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<QuotationListFilterState>(
    DEFAULT_QUOTATION_LIST_FILTERS
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredQuotations = useMemo(
    () => filterQuotationRows(quotations, filters),
    [quotations, filters]
  );

  const mastheadMetrics = useMemo(() => {
    const draftCount = quotations.filter((row) => row.status === "draft").length;
    const approvedCount = quotations.filter(
      (row) => row.status === "approved"
    ).length;
    const lineCount = quotations.reduce((sum, row) => sum + row.item_count, 0);
    const clientCost = quotations.reduce(
      (sum, row) => sum + row.total_revenue_egp,
      0
    );
    const baseCost = quotations.reduce(
      (sum, row) => sum + row.total_cost_egp,
      0
    );
    const avgGp =
      quotations.length > 0
        ? quotations.reduce((sum, row) => sum + row.total_gp_pct, 0) /
          quotations.length
        : 0;
    const creators = uniqueCreatorCount(quotations);

    return [
      quotations.length > 0
        ? { label: "Quotations", value: quotations.length }
        : null,
      draftCount > 0 ? { label: "Draft", value: draftCount } : null,
      approvedCount > 0
        ? { label: "Approved", value: approvedCount, tone: "g" as const }
        : null,
      lineCount > 0 ? { label: "Lines", value: lineCount } : null,
      { label: "Ccy", value: "EGP", tone: "s" as const },
      clientCost > 0
        ? { label: "Client cost", value: AB(clientCost), tone: "s" as const }
        : null,
      baseCost > 0
        ? { label: "Base cost", value: AB(baseCost), tone: "s" as const }
        : null,
      quotations.length > 0
        ? {
            label: "Avg GP %",
            value: `${avgGp.toFixed(1)}%`,
            tone: "r" as const,
          }
        : null,
      creators > 0 ? { label: "Creators", value: creators } : null,
    ].filter((metric): metric is NonNullable<typeof metric> => metric !== null);
  }, [quotations]);

  const filteredLineCount = useMemo(
    () => filteredQuotations.reduce((sum, row) => sum + row.item_count, 0),
    [filteredQuotations]
  );

  const filteredClientCost = useMemo(
    () =>
      filteredQuotations.reduce((sum, row) => sum + row.total_revenue_egp, 0),
    [filteredQuotations]
  );

  const visibleIds = useMemo(
    () => filteredQuotations.map((row) => row.id),
    [filteredQuotations]
  );

  useEffect(() => {
    writeListNavContext("quotations", {
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
    () => filteredQuotations.filter((row) => effectiveSelectedIds.has(row.id)),
    [filteredQuotations, effectiveSelectedIds]
  );

  const bulkActions = useMemo(
    () => resolveBulkQuotationActions(selectedRows),
    [selectedRows]
  );

  const runBulkAction = useCallback(
    (def: QuotationListActionDef) => {
      const ids = selectedRows.map((row) => row.id);
      startTransition(async () => {
        let updated = 0;
        let skipped = 0;
        let lastError: string | undefined;

        for (const id of ids) {
          const row = selectedRows.find((item) => item.id === id);
          if (!row || !def.show(row)) {
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
            `${updated} quotation${updated === 1 ? "" : "s"} ${def.label.toLowerCase()}.` +
              (skipped > 0 ? ` ${skipped} skipped.` : "")
          );
          setSelectedIds(new Set());
          router.refresh();
        } else {
          toast.error(lastError ?? "No quotations were updated.");
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
  const cardSubtitle = `${quotations.length} total · newest first`;

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
          aria-label="Select all quotations"
          disabled={isPending}
        />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>Serial</DiscoverySuiteCell>
      <DiscoverySuiteCell>Quotation</DiscoverySuiteCell>
      <DiscoverySuiteCell>Brand</DiscoverySuiteCell>
      <DiscoverySuiteCell>Client</DiscoverySuiteCell>
      <DiscoverySuiteCell>Status</DiscoverySuiteCell>
      <DiscoverySuiteCell>Client link</DiscoverySuiteCell>
      <DiscoverySuiteCell>Owner</DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Lines
      </DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Client cost
      </DiscoverySuiteCell>
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
        {filteredQuotations.length} of {quotations.length} shown
      </DiscoverySuiteCell>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell className="tw-v" align="end">
        {filteredLineCount}
      </DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-v" align="end">
        {F(filteredClientCost)}
      </DiscoverySuiteCell>
      <DiscoverySuiteCell />
    </>
  );

  return (
    <div className="discovery-suite flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--tw-bg)]">
      <div className="shrink-0 px-[22px] pt-[18px]">
        <DiscoverySuiteMasthead
          title="Client quotations"
          subtitle="Build, price and export influencer proposals for clients"
          metrics={mastheadMetrics}
          freezeOnScroll={false}
        />
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-[22px] pb-10",
          quotationListFloatingBarContentClass(showFloatingBar)
        )}
      >
        <div className="tw-c">
          <div className="tw-ch">
            <span className="tw-ct">Client quotations</span>
            <span className="tw-cs">{cardSubtitle}</span>
            <span className="tw-sp" />
            <span className="tw-search" style={{ flex: "0 0 220px" }}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4.3-4.3" />
              </svg>
              <input
                className="tw-in"
                placeholder="Search quotations…"
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
            <CreateQuotationDialog options={formOptions} />
          </div>

          {filtersOpen ? (
            <div className="border-b border-[var(--tw-line)] px-[15px] py-2">
              <QuotationListFilterBar
                filters={filters}
                onChange={setFilters}
                brands={brands}
                resultCount={filteredQuotations.length}
                totalCount={quotations.length}
                inline
              />
            </div>
          ) : null}

          {filteredQuotations.length === 0 ? (
            <DiscoveryFilteredEmptyState
              title="No quotations match your filters"
              onReset={() => setFilters(DEFAULT_QUOTATION_LIST_FILTERS)}
              className="m-4"
            />
          ) : (
            <DiscoverySuiteGrid
              cols="quotations"
              minWidth={QUOTATIONS_MIN_W}
              framed={false}
              header={header}
              footer={footer}
            >
              {filteredQuotations.map((row, index) => {
                const serial = row.serial_number ?? row.id;
                const isSelected = effectiveSelectedIds.has(row.id);
                const brand = row.brand_name?.trim() ?? "";
                const client = row.client_name?.trim() ?? "";
                const ownerLabel = row.owner_name ?? "—";
                const statusLabel =
                  QUOTATION_STATUS_LABELS[row.status] ?? row.status;

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
                      <Link href={quotationDetailPath(row)} className="tw-nm">
                        {row.name}
                      </Link>
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className={brand ? "tw-br" : "tw-miss"}>
                      {brand || "not set"}
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell>
                      <span className="tw-t" title={client || undefined}>
                        {client || "—"}
                      </span>
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
                        source="quotation"
                        id={row.id}
                        link={row.client_workspace_link}
                      />
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
                      {row.item_count}
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className="tw-v" align="end">
                      {F(row.total_revenue_egp)}
                    </DiscoverySuiteCell>
                    <DiscoverySuiteCell className="tw-act" align="end">
                      <Link href={quotationDetailPath(row)} className="tw-b sm">
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

      <QuotationSelectionFlyout
        selectedCount={selectedCount}
        selectableCount={visibleIds.length}
        actions={bulkActions}
        busy={isPending}
        onClearSelection={clearSelection}
        onSelectAll={selectAllVisible}
        onAction={runBulkAction}
      />
    </div>
  );
}
