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
import {
  QUOTATION_CLIENT_LABELS,
  quotationDetailPath,
} from "../constants";
import {
  actionsForQuotationRow,
  resolveBulkQuotationActions,
  type QuotationListActionDef,
  type QuotationListActionKey,
} from "../quotation-list-actions";
import {
  DEFAULT_QUOTATION_LIST_FILTERS,
  filterQuotationRows,
  type QuotationListFilterState,
} from "../quotation-list-filters";
import type { QuotationListRow } from "../types";
import { QuotationListFilterBar } from "./quotation-list-filter-bar";
import { QuotationStatusBadge } from "./quotation-status-badge";
import {
  QuotationSelectionFlyout,
  quotationListFloatingBarContentClass,
} from "./quotation-selection-flyout";

const TABLE_HEAD_CLASS =
  "h-9 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const TABLE_CELL_CLASS = "px-3 py-2.5 align-middle";

const LIST_ACTION_RUNNERS: Record<
  QuotationListActionKey,
  (id: string) => Promise<{ ok: boolean; message?: string }>
> = {
  archive: archiveQuotation,
};

function egp(n: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)} EGP`;
}

type BrandOption = {
  id: string;
  name: string;
  client_name?: string | null;
};

type Props = {
  quotations: QuotationListRow[];
  brands?: BrandOption[];
};

export function QuotationsList({ quotations, brands = [] }: Props) {
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
    (row: QuotationListRow, def: QuotationListActionDef) => {
      runAction(() => LIST_ACTION_RUNNERS[def.key](row.id));
    },
    [runAction]
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
    <div className="space-y-2">
      <QuotationListFilterBar
        filters={filters}
        onChange={setFilters}
        brands={brands}
        resultCount={filteredQuotations.length}
        totalCount={quotations.length}
      />

      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border/80",
          "bg-card/75 shadow-[0_8px_32px_rgba(15,23,42,0.06)] backdrop-blur-md",
          "dark:bg-card/60 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
          quotationListFloatingBarContentClass(showFloatingBar)
        )}
      >
        {filteredQuotations.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium">No quotations match your filters</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try adjusting search or filter criteria.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={() => setFilters(DEFAULT_QUOTATION_LIST_FILTERS)}
            >
              Reset filters
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 px-2">
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
                <TableHead className={TABLE_HEAD_CLASS}>Serial</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Quotation</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Client / Brand</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Status</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Owner</TableHead>
                <TableHead className={cn(TABLE_HEAD_CLASS, "text-right")}>
                  Creators
                </TableHead>
                <TableHead className={cn(TABLE_HEAD_CLASS, "text-right")}>
                  {QUOTATION_CLIENT_LABELS.clientCost}
                </TableHead>
                <TableHead className={cn(TABLE_HEAD_CLASS, "text-right")}>GP %</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>Updated</TableHead>
                <TableHead className="w-12 px-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotations.map((row) => {
                const actions = actionsForQuotationRow(row);
                const ownerLabel = row.owner_name ?? "Unknown";
                const isSelected = effectiveSelectedIds.has(row.id);

                return (
                  <TableRow key={row.id} data-state={isSelected ? "selected" : undefined}>
                    <TableCell className="w-10 px-2 py-2.5 align-middle">
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
                        TABLE_CELL_CLASS,
                        "font-mono text-xs text-muted-foreground"
                      )}
                    >
                      {row.serial_number ?? "—"}
                    </TableCell>
                    <TableCell className={TABLE_CELL_CLASS}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <InitialsAvatar
                          name={row.name}
                          seed={row.id}
                          sizeClass="size-9 text-[11px]"
                        />
                        <div className="min-w-0">
                          <Link
                            href={quotationDetailPath(row.id)}
                            className="block truncate font-medium hover:underline"
                          >
                            {row.name}
                          </Link>
                          {row.campaign_name ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {row.campaign_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={cn(TABLE_CELL_CLASS, "text-sm text-muted-foreground")}>
                      <span className="block truncate">
                        {[row.client_name, row.brand_name].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </TableCell>
                    <TableCell className={TABLE_CELL_CLASS}>
                      <QuotationStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className={TABLE_CELL_CLASS}>
                      <div className="flex min-w-0 items-center gap-2">
                        <InitialsAvatar
                          name={ownerLabel}
                          seed={row.owner_id ?? row.id}
                          sizeClass="size-7 text-[10px]"
                        />
                        <span className="truncate text-sm text-muted-foreground">
                          {row.owner_name ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={TABLE_CELL_CLASS}>
                      <ShortlistCreatorPreviewStack
                        previews={row.creator_previews}
                        totalCount={row.item_count}
                      />
                    </TableCell>
                    <TableCell className={cn(TABLE_CELL_CLASS, "text-right tabular-nums")}>
                      {egp(row.total_revenue_egp)}
                    </TableCell>
                    <TableCell className={cn(TABLE_CELL_CLASS, "text-right tabular-nums")}>
                      {row.total_gp_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className={cn(TABLE_CELL_CLASS, "text-muted-foreground")}>
                      {row.updated_at
                        ? format(new Date(row.updated_at), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="px-2 py-2.5 align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            aria-label="Quotation actions"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={quotationDetailPath(row.id)}>Open</Link>
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
