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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  countSelected,
  isAllVisibleSelected,
  isIndeterminateSelection,
  pruneSelection,
  toggleItemSelection,
  toggleSelectAll,
} from "@/features/discovery/shortlists/bulk-selection-policy";
import {
  InitialsAvatar,
  ShortlistCreatorPreviewStack,
} from "@/features/discovery/shortlists/components/shortlist-row-visuals";
import { cn } from "@/lib/utils";

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
import {
  QuotationSelectionFlyout,
  quotationListFloatingBarContentClass,
} from "./quotation-selection-flyout";
import { QuotationsListMergedHeader } from "./quotations-list-header";

import { DiscoveryFilteredEmptyState } from "@/features/discovery/components/design-system";

const LIST_ACTION_RUNNERS: Record<
  QuotationListActionKey,
  (id: string) => Promise<{ ok: boolean; message?: string }>
> = {
  archive: archiveQuotation,
};

const TABLE_GUTTER_START = "pl-8";
const TABLE_GUTTER_END = "pr-8";
const QUOTATION_LIST_HEAD_CLASS =
  "h-auto bg-transparent px-4 py-[13px] text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground";
const QUOTATION_LIST_CELL_CLASS =
  "border-t border-border px-4 py-3.5 align-middle text-[13px] text-[var(--text-2)]";
const QUOTATION_LIST_ROW_CLASS = "group transition-colors hover:bg-muted/20";

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
          <Table variant="flush">
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className={cn(QUOTATION_LIST_HEAD_CLASS, TABLE_GUTTER_START, "w-[34px]")}>
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
                </TableHead>
                <TableHead className={QUOTATION_LIST_HEAD_CLASS}>Serial</TableHead>
                <TableHead className={QUOTATION_LIST_HEAD_CLASS}>Quotation</TableHead>
                <TableHead className={QUOTATION_LIST_HEAD_CLASS}>Status</TableHead>
                <TableHead className={QUOTATION_LIST_HEAD_CLASS}>Owner</TableHead>
                <TableHead className={QUOTATION_LIST_HEAD_CLASS}>Creators</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotations.map((row) => {
                const ownerLabel = row.owner_name ?? "Unknown";
                const isSelected = effectiveSelectedIds.has(row.id);

                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={QUOTATION_LIST_ROW_CLASS}
                  >
                    <TableCell className={cn(QUOTATION_LIST_CELL_CLASS, TABLE_GUTTER_START, "w-[34px]")}>
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
                        QUOTATION_LIST_CELL_CLASS,
                        "tabular-nums text-[12px] font-bold text-[var(--text)]"
                      )}
                    >
                      {row.serial_number ?? "—"}
                    </TableCell>
                    <TableCell className={QUOTATION_LIST_CELL_CLASS}>
                      <div className="flex min-w-0 items-center gap-[11px]">
                        <InitialsAvatar
                          name={row.name}
                          seed={row.id}
                          sizeClass="size-8 text-[11px]"
                        />
                        <div className="min-w-0">
                          <Link
                            href={quotationDetailPath(row)}
                            className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)] transition-colors group-hover:text-[var(--blue-text)]"
                          >
                            {row.name}
                          </Link>
                          {(row.brand_name || row.client_name) && (
                            <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                              {row.brand_name}
                              {row.client_name ? ` · ${row.client_name}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={QUOTATION_LIST_CELL_CLASS}>
                      <QuotationListStatusPill status={row.status} />
                    </TableCell>
                    <TableCell className={QUOTATION_LIST_CELL_CLASS}>
                      <div className="flex min-w-0 items-center gap-[9px]">
                        <InitialsAvatar
                          name={ownerLabel}
                          seed={row.owner_id ?? row.id}
                          sizeClass="size-6 text-[9.5px]"
                        />
                        <span className="truncate text-[12.5px] text-[var(--text-2)]">
                          {row.owner_name ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={cn(QUOTATION_LIST_CELL_CLASS, TABLE_GUTTER_END)}>
                      <ShortlistCreatorPreviewStack
                        previews={row.creator_previews}
                        totalCount={row.item_count}
                        align="start"
                        overflowVariant="solid"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
