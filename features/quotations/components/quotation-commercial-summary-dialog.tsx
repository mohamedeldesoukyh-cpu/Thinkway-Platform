"use client";

import { useEffect, useMemo, useState } from "react";
import { Table2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  computeQuotationRowComputed,
  resolveQuotationRowDraft,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import type { QuotationItemRow } from "@/features/quotations/types";
import { QuotationCommercialSummarySortableHead } from "@/features/quotations/components/quotation-commercial-summary-sort-header";
import { optionNumberLabel } from "@/lib/quotations/quotation-deliverable-types";
import { buildQuotationItemOptionContext } from "@/lib/quotations/quotation-creator-options";
import {
  sortQuotationCommercialSummaryRows,
  type QuotationCommercialSummarySortRow,
  type QuotationCommercialSummarySortState,
} from "@/lib/quotations/quotation-commercial-summary-sort";
import { cn } from "@/lib/utils";

/** Palette from commercial-summary reference sheet */
const CS = {
  dark: "#141413",
  gray: "#6b6a63",
  muted: "#9a988f",
  line: "#e8e6dc",
  panel: "#f4f3ee",
  green: "#3B6D11",
} as const;

function fmtStat(n: number): string {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0)} EGP`;
}

function fmtCell(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtGpPct(gp: number, revenue: number, rowGpPct: number): string {
  if (!Number.isFinite(revenue) || revenue <= 0) return "0.0%";
  if (revenue === 0 && gp === 0) return "0.0%";
  const pct = revenue > 0 ? (gp / revenue) * 100 : rowGpPct;
  return `${pct.toFixed(1)}%`;
}

export type QuotationCommercialSummaryRow = QuotationCommercialSummarySortRow;

function buildSummaryRows(
  items: QuotationItemRow[],
  drafts: Record<string, QuotationRowDraft | undefined>
): QuotationCommercialSummaryRow[] {
  const optionContext = buildQuotationItemOptionContext(items);

  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => {
      const draft = resolveQuotationRowDraft(item, drafts[item.id]);
      const computed = computeQuotationRowComputed(draft);
      const optionCtx = optionContext.get(item.id);
      const showOption = (optionCtx?.duplicateCount ?? 1) > 1;

      return {
        itemId: item.id,
        influencerName: item.creator_name?.trim() || item.handle?.trim() || "Unknown creator",
        optionLabel: showOption
          ? (optionNumberLabel(optionCtx?.optionNumber ?? item.option_number) ?? null)
          : null,
        revenueEgp: computed.revenueEgp,
        costEgp: computed.costEgp,
        gpValueEgp: computed.gpValueEgp,
        gpPct: computed.gpPct,
      };
    });
}

function sumSelected(rows: QuotationCommercialSummaryRow[], selectedIds: Set<string>) {
  return rows.reduce(
    (acc, row) => {
      if (!selectedIds.has(row.itemId)) return acc;
      acc.revenue += row.revenueEgp;
      acc.cost += row.costEgp;
      acc.gp += row.gpValueEgp;
      return acc;
    },
    { revenue: 0, cost: 0, gp: 0 }
  );
}

function StatCard({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div
      className="rounded-lg px-3.5 py-3"
      style={{ backgroundColor: CS.panel }}
    >
      <p
        className="m-0 text-[11px] font-medium uppercase tracking-[0.05em]"
        style={{ color: CS.muted }}
      >
        {label}
      </p>
      <p
        className="m-0 mt-1.5 text-lg font-semibold tabular-nums"
        style={{ color: green ? CS.green : CS.dark }}
      >
        {value}
      </p>
    </div>
  );
}

type Props = {
  items: QuotationItemRow[];
  drafts: Record<string, QuotationRowDraft | undefined>;
  triggerClassName?: string;
};

export function QuotationCommercialSummaryDialog({
  items,
  drafts,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [tableSort, setTableSort] = useState<QuotationCommercialSummarySortState | null>(null);

  const rows = useMemo(() => buildSummaryRows(items, drafts), [items, drafts]);
  const sortedRows = useMemo(
    () => sortQuotationCommercialSummaryRows(rows, tableSort),
    [rows, tableSort]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(rows.map((row) => row.itemId)));
  }, [open, rows]);

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.itemId));
  const totalsAll = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          revenue: acc.revenue + row.revenueEgp,
          cost: acc.cost + row.costEgp,
          gp: acc.gp + row.gpValueEgp,
        }),
        { revenue: 0, cost: 0, gp: 0 }
      ),
    [rows]
  );
  const totalsSelected = useMemo(
    () => sumSelected(rows, selectedIds),
    [rows, selectedIds]
  );
  const displayTotals = selectedIds.size > 0 ? totalsSelected : totalsAll;

  const toggleRow = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      return new Set(rows.map((row) => row.itemId));
    });
  };

  const selectionLabel =
    selectedIds.size === 0
      ? "no rows selected"
      : selectedIds.size === rows.length
        ? "all rows selected"
        : `${selectedIds.size} of ${rows.length} selected`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded-[9px] border-[var(--q-line-2,#e3e8f2)] text-[12.5px] font-semibold shadow-none",
            triggerClassName
          )}
        >
          <Table2Icon className="size-3.5" />
          Commercial summary
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className={cn(
          "flex h-[min(88vh,680px)] max-h-[min(88vh,680px)] min-h-0 w-[min(96vw,1120px)] max-w-[min(96vw,1120px)] flex-col gap-0 overflow-hidden rounded-xl border-[0.5px] p-0 sm:max-w-[min(96vw,1120px)]"
        )}
        style={{
          borderColor: CS.line,
          backgroundColor: "#fff",
          color: CS.dark,
        }}
      >
        <div
          className="shrink-0 px-[22px] py-4"
          style={{ borderBottom: `0.5px solid ${CS.line}` }}
        >
          <DialogTitle
            className="m-0 text-base font-semibold"
            style={{ color: CS.dark }}
          >
            Commercial summary
          </DialogTitle>
          <p className="m-0 mt-0.5 text-xs" style={{ color: CS.gray }}>
            {rows.length} lines · {selectionLabel}
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2.5 px-[22px] py-4 sm:grid-cols-4">
          <StatCard label="Revenue" value={fmtStat(displayTotals.revenue)} />
          <StatCard label="Cost" value={fmtStat(displayTotals.cost)} />
          <StatCard label="GP" value={fmtStat(displayTotals.gp)} green />
          <StatCard
            label="GP %"
            value={fmtGpPct(displayTotals.gp, displayTotals.revenue, 0)}
            green
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[22px] pb-[18px]">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-[13px]">
              <colgroup>
                <col className="w-9" />
                <col />
                <col className="w-[7.5rem]" />
                <col className="w-[7.5rem]" />
                <col className="w-[7.5rem]" />
                <col className="w-[4.5rem]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th
                    className="pb-2 pl-0 pr-1 pt-2"
                    style={{ borderBottom: `0.5px solid ${CS.line}` }}
                  >
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all influencers"
                    />
                  </th>
                  <QuotationCommercialSummarySortableHead
                    label="Influencer"
                    field="influencer"
                    sort={tableSort}
                    onSortChange={setTableSort}
                  />
                  <QuotationCommercialSummarySortableHead
                    label="Revenue"
                    field="revenue"
                    align="right"
                    sort={tableSort}
                    onSortChange={setTableSort}
                  />
                  <QuotationCommercialSummarySortableHead
                    label="Cost"
                    field="cost"
                    align="right"
                    sort={tableSort}
                    onSortChange={setTableSort}
                  />
                  <QuotationCommercialSummarySortableHead
                    label="GP"
                    field="gp"
                    align="right"
                    sort={tableSort}
                    onSortChange={setTableSort}
                  />
                  <QuotationCommercialSummarySortableHead
                    label="GP %"
                    field="gpPct"
                    align="right"
                    sort={tableSort}
                    onSortChange={setTableSort}
                  />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center" style={{ color: CS.muted }}>
                      No creators in this quotation yet.
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row) => {
                    const selected = selectedIds.has(row.itemId);
                    const isZero = row.revenueEgp === 0;
                    const hasValue = row.revenueEgp > 0;

                    return (
                      <tr
                        key={row.itemId}
                        onClick={() => toggleRow(row.itemId)}
                        className={cn(
                          "cursor-pointer",
                          !selected && "opacity-45",
                          isZero && selected && "opacity-100"
                        )}
                        style={{ color: isZero && selected ? CS.muted : CS.dark }}
                      >
                        <td
                          className="border-t py-2 pl-0 pr-1"
                          style={{ borderColor: CS.line }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleRow(row.itemId)}
                            aria-label={`Select ${row.influencerName}`}
                          />
                        </td>
                        <td
                          className="border-t py-2 pl-0 pr-1.5 text-left"
                          style={{ borderColor: CS.line }}
                        >
                          {row.influencerName}
                          {row.optionLabel ? (
                            <span className="ml-1.5 text-xs" style={{ color: CS.muted }}>
                              {row.optionLabel}
                            </span>
                          ) : null}
                        </td>
                        <td
                          className="border-t px-1.5 py-2 text-right tabular-nums"
                          style={{ borderColor: CS.line }}
                        >
                          {fmtCell(row.revenueEgp)}
                        </td>
                        <td
                          className="border-t px-1.5 py-2 text-right tabular-nums"
                          style={{ borderColor: CS.line }}
                        >
                          {fmtCell(row.costEgp)}
                        </td>
                        <td
                          className="border-t px-1.5 py-2 text-right tabular-nums"
                          style={{
                            borderColor: CS.line,
                            color: hasValue ? CS.green : undefined,
                          }}
                        >
                          {fmtCell(row.gpValueEgp)}
                        </td>
                        <td
                          className="border-t px-1.5 py-2 text-right tabular-nums"
                          style={{
                            borderColor: CS.line,
                            color: hasValue ? CS.green : undefined,
                          }}
                        >
                          {fmtGpPct(row.gpValueEgp, row.revenueEgp, row.gpPct)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {rows.length > 0 ? (
            <div
              className="relative z-10 shrink-0 bg-white pt-1"
              style={{ borderTop: `1.5px solid #d9d7cc` }}
            >
              <table className="w-full border-collapse text-[13px] font-semibold">
                <colgroup>
                  <col className="w-9" />
                  <col />
                  <col className="w-[7.5rem]" />
                  <col className="w-[7.5rem]" />
                  <col className="w-[7.5rem]" />
                  <col className="w-[4.5rem]" />
                </colgroup>
                <tbody>
                  <tr style={{ color: CS.dark }}>
                    <td className="py-2.5 pl-0 pr-1" />
                    <td className="py-2.5 pl-0 pr-1.5 text-left">
                      Total · {rows.length} lines
                    </td>
                    <td className="px-1.5 py-2.5 text-right tabular-nums">
                      {fmtCell(totalsAll.revenue) === "—"
                        ? "—"
                        : new Intl.NumberFormat("en-US").format(totalsAll.revenue)}
                    </td>
                    <td className="px-1.5 py-2.5 text-right tabular-nums">
                      {fmtCell(totalsAll.cost) === "—"
                        ? "—"
                        : new Intl.NumberFormat("en-US").format(totalsAll.cost)}
                    </td>
                    <td
                      className="px-1.5 py-2.5 text-right tabular-nums"
                      style={{ color: CS.green }}
                    >
                      {fmtCell(totalsAll.gp) === "—"
                        ? "—"
                        : new Intl.NumberFormat("en-US").format(totalsAll.gp)}
                    </td>
                    <td
                      className="px-1.5 py-2.5 text-right tabular-nums"
                      style={{ color: CS.green }}
                    >
                      {fmtGpPct(totalsAll.gp, totalsAll.revenue, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
