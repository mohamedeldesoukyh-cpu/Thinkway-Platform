"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  buildListNavFilterKey,
  writeListNavContext,
} from "@/lib/navigation/list-nav-context";

import { Checkbox } from "@/components/ui/checkbox";
import {
  countSelected,
  isAllVisibleSelected,
  isIndeterminateSelection,
  pruneSelection,
  toggleItemSelection,
  toggleSelectAll,
} from "@/features/discovery/shortlists/bulk-selection-policy";
import { InitialsAvatar } from "@/features/discovery/shortlists/components/shortlist-row-visuals";
import { cn } from "@/lib/utils";
import { formatMoneyKpi } from "@/lib/finance/currency-format";
import { formatDiscoveryDate } from "@/lib/discovery/format-discovery-date";

import { archiveQuotation } from "../actions";
import { quotationDetailPath } from "../constants";
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
import { QuotationListStatusPill } from "./quotation-list-status-pill";
import { ClientWorkspaceListLinkCell } from "@/features/client-workspace/components/client-workspace-list-link-cell";
import {
  QuotationSelectionFlyout,
  quotationListFloatingBarContentClass,
} from "./quotation-selection-flyout";
import { QuotationsListMergedHeader } from "./quotations-list-header";

import {
  DiscoveryFilteredEmptyState,
  DiscoverySuiteCell,
  DiscoverySuiteGrid,
  DiscoverySuiteMasthead,
  DiscoverySuiteRow,
} from "@/features/discovery/components/design-system";

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

export function QuotationsList({ quotations, brands = [], formOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<QuotationListFilterState>(
    DEFAULT_QUOTATION_LIST_FILTERS
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredQuotations = useMemo(
    () => filterQuotationRows(quotations, filters),
    [quotations, filters]
  );

  const mastheadMetrics = useMemo(() => {
    const draftCount = filteredQuotations.filter(
      (row) => row.status === "draft"
    ).length;
    const approvedCount = filteredQuotations.filter(
      (row) => row.status === "approved"
    ).length;
    const lineCount = filteredQuotations.reduce(
      (sum, row) => sum + row.item_count,
      0
    );

    return [
      { label: "Quotations", value: filteredQuotations.length },
      ...(draftCount > 0
        ? [{ label: "Draft", value: draftCount, tone: "y" as const }]
        : []),
      ...(approvedCount > 0
        ? [{ label: "Approved", value: approvedCount, tone: "g" as const }]
        : []),
      ...(lineCount > 0 ? [{ label: "Lines", value: lineCount }] : []),
    ];
  }, [filteredQuotations]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <QuotationsListMergedHeader
        filters={filters}
        onChange={setFilters}
        brands={brands}
        formOptions={formOptions}
        resultCount={filteredQuotations.length}
        totalCount={quotations.length}
      />

      <div className="shrink-0 px-8 pt-4">
        <DiscoverySuiteMasthead
          title="Client quotations"
          metrics={mastheadMetrics}
          freezeOnScroll={false}
        />
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain",
          quotationListFloatingBarContentClass(showFloatingBar)
        )}
      >
        {filteredQuotations.length === 0 ? (
          <DiscoveryFilteredEmptyState
            title="No quotations match your filters"
            onReset={() => setFilters(DEFAULT_QUOTATION_LIST_FILTERS)}
            className="mx-8"
          />
        ) : (
          <DiscoverySuiteGrid
            cols="quotations"
            className="mx-8"
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
                <DiscoverySuiteCell align="end">Lines</DiscoverySuiteCell>
                <DiscoverySuiteCell align="end">Client cost</DiscoverySuiteCell>
                <DiscoverySuiteCell align="end">Act</DiscoverySuiteCell>
              </>
            }
          >
            {filteredQuotations.map((row) => {
              const ownerLabel = row.owner_name ?? "Unknown";
              const isSelected = effectiveSelectedIds.has(row.id);
              const issuedAt = formatDiscoveryDate(row.issue_date);

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
                      aria-label={`Select ${row.name}`}
                      disabled={isPending}
                    />
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell className="tw-id">
                    {row.serial_number ?? "—"}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell>
                    <div className="min-w-0">
                      <Link
                        href={quotationDetailPath(row)}
                        className="tw-nm block transition-colors group-hover:text-[var(--tw-bi)]"
                      >
                        {row.name}
                      </Link>
                      {issuedAt ? (
                        <span className="tw-s">Issued {issuedAt}</span>
                      ) : null}
                    </div>
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell>
                    {row.brand_name ? (
                      <span className="tw-br">{row.brand_name}</span>
                    ) : (
                      <span className="tw-miss">not set</span>
                    )}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell className="tw-t">
                    {row.client_name ?? "—"}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell>
                    <QuotationListStatusPill status={row.status} />
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell className="min-w-0 overflow-visible whitespace-normal">
                    <ClientWorkspaceListLinkCell
                      source="quotation"
                      id={row.id}
                      link={row.client_workspace_link}
                    />
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell>
                    <div className="flex min-w-0 items-center gap-[9px]">
                      <InitialsAvatar
                        name={ownerLabel}
                        seed={row.owner_id ?? row.id}
                        sizeClass="size-6 text-[9.5px]"
                      />
                      <span className="tw-t">{row.owner_name ?? "—"}</span>
                    </div>
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell align="end" className="tw-v">
                    {row.item_count}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell align="end" className="tw-v">
                    {formatMoneyKpi(row.total_revenue_egp, "EGP")}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell align="end">
                    <Link
                      href={quotationDetailPath(row)}
                      className="tw-b sm"
                    >
                      Open
                    </Link>
                  </DiscoverySuiteCell>
                </DiscoverySuiteRow>
              );
            })}
          </DiscoverySuiteGrid>
        )}
        <div className="h-10 shrink-0" aria-hidden />
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
