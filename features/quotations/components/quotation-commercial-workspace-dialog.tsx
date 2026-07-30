"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  Columns3Icon,
  Loader2Icon,
  Redo2Icon,
  Table2Icon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { UnsavedChangesBar } from "@/components/forms/unsaved-changes-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMMERCIAL_INPUT_MODE_LABELS } from "@/lib/domains/commercial/quotation-constants";
import type { CommercialInputMode } from "@/lib/commercial/commercial-engine";
import {
  applyCommercialWorkspaceBulkOp,
  applyCommercialWorkspaceBulkOpToDrafts,
  type CommercialWorkspaceBulkOp,
} from "@/lib/quotations/commercial-workspace/bulk-transforms";
import {
  COMMERCIAL_WORKSPACE_COLUMN_LABELS,
  DEFAULT_COMMERCIAL_WORKSPACE_COLUMNS,
  readCommercialWorkspaceColumnPrefs,
  writeCommercialWorkspaceColumnPrefs,
  type CommercialWorkspaceColumnId,
  type CommercialWorkspaceColumnPrefs,
} from "@/lib/quotations/commercial-workspace/column-preferences";
import {
  canRedoCommercialDraft,
  canUndoCommercialDraft,
  createCommercialDraftHistory,
  pushCommercialDraftHistory,
  redoCommercialDraftHistory,
  resetCommercialDraftHistory,
  undoCommercialDraftHistory,
  type CommercialDraftHistoryState,
} from "@/lib/quotations/commercial-workspace/draft-history";
import {
  countCommercialHealth,
  filterCommercialWorkspaceRows,
  QUICK_FILTER_LABELS,
  type CommercialWorkspaceQuickFilter,
} from "@/lib/quotations/commercial-workspace/filters";
import {
  profitabilityBandLabel,
  resolveProfitabilityBand,
} from "@/lib/quotations/commercial-workspace/profitability-thresholds";
import { draftToLinePending } from "@/lib/quotations/commercial-workspace/stage-pending";
import { cn } from "@/lib/utils";

import { recordCommercialWorkspaceSaveAudit } from "@/features/quotations/actions";
import { useQuotationManualSave } from "@/features/quotations/components/quotation-manual-save";
import { QuotationCommercialSummarySortableHead } from "@/features/quotations/components/quotation-commercial-summary-sort-header";
import {
  computeQuotationRowComputed,
  resolveQuotationRowDraft,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import type { QuotationItemRow } from "@/features/quotations/types";
import {
  sortQuotationCommercialSummaryRows,
  type QuotationCommercialSummarySortState,
} from "@/lib/quotations/quotation-commercial-summary-sort";
import { optionNumberLabel } from "@/lib/quotations/quotation-deliverable-types";
import { buildQuotationItemOptionContext } from "@/lib/quotations/quotation-creator-options";

const CS = {
  dark: "#141413",
  gray: "#6b6a63",
  muted: "#9a988f",
  line: "#e8e6dc",
  panel: "#f4f3ee",
  green: "#3B6D11",
  warn: "#A16207",
  critical: "#B91C1C",
} as const;

const MODE_OPTIONS = Object.entries(COMMERCIAL_INPUT_MODE_LABELS) as [
  CommercialInputMode,
  string,
][];

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
  const pct = revenue > 0 ? (gp / revenue) * 100 : rowGpPct;
  return `${pct.toFixed(1)}%`;
}

type WorkspaceRow = {
  itemId: string;
  influencerName: string;
  optionLabel: string | null;
  revenueEgp: number;
  costEgp: number;
  gpValueEgp: number;
  gpPct: number;
  draft: QuotationRowDraft;
};

function buildRows(
  items: QuotationItemRow[],
  drafts: Record<string, QuotationRowDraft | undefined>
): WorkspaceRow[] {
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
        influencerName:
          item.creator_name?.trim() || item.handle?.trim() || "Unknown creator",
        optionLabel: showOption
          ? (optionNumberLabel(optionCtx?.optionNumber ?? item.option_number) ?? null)
          : null,
        revenueEgp: computed.revenueEgp,
        costEgp: computed.costEgp,
        gpValueEgp: computed.gpValueEgp,
        gpPct: computed.gpPct,
        draft,
      };
    });
}

function sumRows(rows: WorkspaceRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.revenue += row.revenueEgp;
      acc.cost += row.costEgp;
      acc.gp += row.gpValueEgp;
      return acc;
    },
    { revenue: 0, cost: 0, gp: 0 }
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "warn" | "critical";
}) {
  const color =
    tone === "green" ? CS.green : tone === "warn" ? CS.warn : tone === "critical" ? CS.critical : CS.dark;
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: CS.panel }}>
      <p
        className="m-0 text-[10px] font-medium uppercase tracking-[0.05em]"
        style={{ color: CS.muted }}
      >
        {label}
      </p>
      <p className="m-0 mt-1 text-base font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

export type QuotationCommercialWorkspaceDialogProps = {
  quotationId: string;
  items: QuotationItemRow[];
  drafts: Record<string, QuotationRowDraft | undefined>;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  /** Merge/replace draft entries (partial map OK). */
  onDraftsMerge: (next: Record<string, QuotationRowDraft>) => void;
  canManage: boolean;
  triggerClassName?: string;
};

export function QuotationCommercialWorkspaceDialog({
  quotationId,
  items,
  drafts,
  onDraftChange,
  onDraftsMerge,
  canManage,
  triggerClassName,
}: QuotationCommercialWorkspaceDialogProps) {
  const manualSave = useQuotationManualSave();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [tableSort, setTableSort] = useState<QuotationCommercialSummarySortState | null>(null);
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<CommercialWorkspaceQuickFilter>("all");
  const [columnPrefs, setColumnPrefs] = useState<CommercialWorkspaceColumnPrefs>(
    DEFAULT_COMMERCIAL_WORKSPACE_COLUMNS
  );
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [bulkKind, setBulkKind] = useState<CommercialWorkspaceBulkOp["kind"]>("set_gp_pct");
  const [bulkValue, setBulkValue] = useState("25");
  const [history, setHistory] = useState<CommercialDraftHistoryState>(() =>
    createCommercialDraftHistory(drafts)
  );
  const [saving, startSaveTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setColumnPrefs(readCommercialWorkspaceColumnPrefs());
    setSelectedIds(new Set(items.map((item) => item.id)));
    setHistory(createCommercialDraftHistory(drafts));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- snapshot on open only

  const rows = useMemo(() => buildRows(items, drafts), [items, drafts]);
  const filtered = useMemo(
    () => filterCommercialWorkspaceRows(rows, quickFilter, search),
    [rows, quickFilter, search]
  );
  const sortedRows = useMemo(
    () => sortQuotationCommercialSummaryRows(filtered, tableSort),
    [filtered, tableSort]
  );
  const health = useMemo(() => countCommercialHealth(rows), [rows]);
  const quotationTotals = useMemo(() => sumRows(rows), [rows]);
  const selectionRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.itemId)),
    [rows, selectedIds]
  );
  const selectionTotals = useMemo(() => sumRows(selectionRows), [selectionRows]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((row) => selectedIds.has(row.itemId));

  const stageDraft = useCallback(
    (id: string, next: QuotationRowDraft, recordHistory = true) => {
      if (recordHistory) {
        setHistory((prev) =>
          pushCommercialDraftHistory(prev, { ...drafts, [id]: next })
        );
      }
      onDraftChange(id, next);
      manualSave.registerLinePending(id, draftToLinePending(next));
    },
    [drafts, manualSave, onDraftChange]
  );

  const stageMany = useCallback(
    (patched: Record<string, QuotationRowDraft>) => {
      const merged = { ...drafts, ...patched };
      setHistory((prev) => pushCommercialDraftHistory(prev, merged));
      onDraftsMerge(patched);
      for (const [id, draft] of Object.entries(patched)) {
        manualSave.registerLinePending(id, draftToLinePending(draft));
      }
    },
    [drafts, manualSave, onDraftsMerge]
  );

  const handleUndo = () => {
    const next = undoCommercialDraftHistory(history);
    if (!next) return;
    setHistory(next);
    onDraftsMerge(next.present);
    for (const [id, draft] of Object.entries(next.present)) {
      manualSave.registerLinePending(id, draftToLinePending(draft));
    }
  };

  const handleRedo = () => {
    const next = redoCommercialDraftHistory(history);
    if (!next) return;
    setHistory(next);
    onDraftsMerge(next.present);
    for (const [id, draft] of Object.entries(next.present)) {
      manualSave.registerLinePending(id, draftToLinePending(draft));
    }
  };

  const handleDiscard = () => {
    const baseline = Object.fromEntries(
      items.map((item) => [item.id, resolveQuotationRowDraft(item)])
    );
    onDraftsMerge(baseline);
    setHistory(resetCommercialDraftHistory(baseline));
    for (const item of items) {
      manualSave.registerLinePending(item.id, draftToLinePending(baseline[item.id]!));
    }
    toast.message("Workspace drafts reset to last saved quotation values.");
  };

  const handleSave = () => {
    startSaveTransition(async () => {
      const pendingIds = items
        .filter((item) => manualSave.isLinePending(item.id))
        .map((item) => item.id);
      const ok = await manualSave.saveAll();
      if (!ok) return;
      if (pendingIds.length > 0) {
        await recordCommercialWorkspaceSaveAudit({
          quotationId,
          lineCount: pendingIds.length,
          changedFields: ["Revenue", "Cost", "GP Target", "AF %", "Currency"],
        });
      }
      setHistory(resetCommercialDraftHistory(drafts));
      toast.success("Commercial Workspace saved.");
    });
  };

  const applyBulk = () => {
    if (!canManage || selectedIds.size === 0) return;
    const pct = Number(bulkValue);
    const currency = bulkValue.trim().toUpperCase();
    let op: CommercialWorkspaceBulkOp;
    switch (bulkKind) {
      case "set_currency":
        op = { kind: "set_currency", currency: currency || "EGP" };
        break;
      case "set_fx":
        op = { kind: "set_fx", fxRateToEgp: Number.isFinite(pct) ? pct : 1 };
        break;
      default:
        if (!Number.isFinite(pct)) {
          toast.error("Enter a valid number.");
          return;
        }
        op = { kind: bulkKind, pct } as CommercialWorkspaceBulkOp;
    }
    const patched = applyCommercialWorkspaceBulkOpToDrafts(
      drafts,
      [...selectedIds],
      op
    );
    stageMany(patched);
    toast.success(`Staged bulk update on ${Object.keys(patched).length} line(s). Save to apply.`);
  };

  const toggleColumn = (id: CommercialWorkspaceColumnId) => {
    setColumnPrefs((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeCommercialWorkspaceColumnPrefs(next);
      return next;
    });
  };

  const bandStyle = (gpPct: number) => {
    const band = resolveProfitabilityBand(gpPct);
    if (band === "healthy") return { background: "rgba(59,109,17,0.08)" };
    if (band === "warning") return { background: "rgba(161,98,7,0.10)" };
    return { background: "rgba(185,28,28,0.08)" };
  };

  const show = (id: CommercialWorkspaceColumnId) => columnPrefs[id];

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
          Commercial Workspace
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="flex h-[min(92vh,820px)] max-h-[min(92vh,820px)] min-h-0 w-[min(98vw,1280px)] max-w-[min(98vw,1280px)] flex-col gap-0 overflow-hidden rounded-xl border-[0.5px] p-0 sm:max-w-[min(98vw,1280px)]"
        style={{ borderColor: CS.line, backgroundColor: "#fff", color: CS.dark }}
      >
        <div
          className="shrink-0 px-5 py-3"
          style={{ borderBottom: `0.5px solid ${CS.line}` }}
        >
          <DialogTitle className="m-0 text-base font-semibold" style={{ color: CS.dark }}>
            Commercial Workspace
          </DialogTitle>
          <p className="m-0 mt-0.5 text-xs" style={{ color: CS.gray }}>
            {rows.length} lines · shared draft with Creators grid · explicit Save
            {!canManage ? " · read-only" : null}
          </p>
        </div>

        {/* Frozen totals + selection + health */}
        <div
          className="shrink-0 space-y-3 px-5 py-3"
          style={{ borderBottom: `0.5px solid ${CS.line}`, background: "#fff" }}
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: CS.muted }}>
                Selection · {selectionRows.length}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard label="Revenue" value={fmtStat(selectionTotals.revenue)} />
                <StatCard label="Cost" value={fmtStat(selectionTotals.cost)} />
                <StatCard label="GP" value={fmtStat(selectionTotals.gp)} tone="green" />
                <StatCard
                  label="GP %"
                  value={fmtGpPct(selectionTotals.gp, selectionTotals.revenue, 0)}
                  tone="green"
                />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: CS.muted }}>
                Quotation · {rows.length}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard label="Revenue" value={fmtStat(quotationTotals.revenue)} />
                <StatCard label="Cost" value={fmtStat(quotationTotals.cost)} />
                <StatCard label="GP" value={fmtStat(quotationTotals.gp)} tone="green" />
                <StatCard
                  label="GP %"
                  value={fmtGpPct(quotationTotals.gp, quotationTotals.revenue, 0)}
                  tone="green"
                />
              </div>
            </div>
            <div className="min-w-[140px]">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: CS.muted }}>
                Commercial Health
              </p>
              <div className="flex flex-col gap-1">
                {(
                  [
                    ["band_healthy", "Healthy", health.healthy, "green"],
                    ["band_warning", "Warning", health.warning, "warn"],
                    ["band_critical", "Critical", health.critical, "critical"],
                  ] as const
                ).map(([filter, label, count, tone]) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setQuickFilter(filter)}
                    className="flex items-center justify-between rounded-md px-2 py-1 text-left text-xs font-medium"
                    style={{
                      background: CS.panel,
                      color:
                        tone === "green" ? CS.green : tone === "warn" ? CS.warn : CS.critical,
                    }}
                  >
                    <span>{label}</span>
                    <span className="tabular-nums">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter influencers…"
              className="h-8 w-[180px] text-xs"
            />
            <Select
              value={quickFilter}
              onValueChange={(v) => setQuickFilter(v as CommercialWorkspaceQuickFilter)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(QUICK_FILTER_LABELS) as CommercialWorkspaceQuickFilter[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {QUICK_FILTER_LABELS[key]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>

            {canManage ? (
              <>
                <Select
                  value={bulkKind}
                  onValueChange={(v) =>
                    setBulkKind(v as CommercialWorkspaceBulkOp["kind"])
                  }
                >
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase_revenue_pct">Increase Revenue %</SelectItem>
                    <SelectItem value="decrease_revenue_pct">Decrease Revenue %</SelectItem>
                    <SelectItem value="increase_cost_pct">Increase Cost %</SelectItem>
                    <SelectItem value="decrease_cost_pct">Decrease Cost %</SelectItem>
                    <SelectItem value="set_gp_pct">Set GP %</SelectItem>
                    <SelectItem value="increase_gp_pct">Increase GP %</SelectItem>
                    <SelectItem value="decrease_gp_pct">Decrease GP %</SelectItem>
                    <SelectItem value="apply_markup_pct">Apply Markup %</SelectItem>
                    <SelectItem value="apply_discount_pct">Apply Discount %</SelectItem>
                    <SelectItem value="set_currency">Change Currency</SelectItem>
                    <SelectItem value="set_fx">Update FX</SelectItem>
                    <SelectItem value="set_af_pct">Update AF %</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="h-8 w-[88px] text-xs"
                  placeholder={bulkKind === "set_currency" ? "EGP" : "%"}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={selectedIds.size === 0}
                  onClick={applyBulk}
                >
                  Apply to selected
                </Button>
              </>
            ) : null}

            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-2"
                disabled={!canUndoCommercialDraft(history)}
                onClick={handleUndo}
                aria-label="Undo"
              >
                <Undo2Icon className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-2"
                disabled={!canRedoCommercialDraft(history)}
                onClick={handleRedo}
                aria-label="Redo"
              >
                <Redo2Icon className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => setColumnsOpen((v) => !v)}
              >
                <Columns3Icon className="size-3.5" />
                Columns
              </Button>
            </div>
          </div>

          {columnsOpen ? (
            <div className="flex flex-wrap gap-3 rounded-lg px-3 py-2" style={{ background: CS.panel }}>
              {(Object.keys(COMMERCIAL_WORKSPACE_COLUMN_LABELS) as CommercialWorkspaceColumnId[]).map(
                (id) => (
                  <label key={id} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={columnPrefs[id]}
                      onCheckedChange={() => toggleColumn(id)}
                    />
                    {COMMERCIAL_WORKSPACE_COLUMN_LABELS[id]}
                  </label>
                )
              )}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-2">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th className="pb-2 pr-1 pt-2" style={{ borderBottom: `0.5px solid ${CS.line}` }}>
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (allFilteredSelected) {
                            filtered.forEach((row) => next.delete(row.itemId));
                          } else {
                            filtered.forEach((row) => next.add(row.itemId));
                          }
                          return next;
                        });
                      }}
                      aria-label="Select filtered"
                    />
                  </th>
                  <QuotationCommercialSummarySortableHead
                    label="Influencer"
                    field="influencer"
                    sort={tableSort}
                    onSortChange={setTableSort}
                  />
                  {show("mode") ? (
                    <th className="px-1 pb-2 pt-2 text-left text-[11px] font-semibold" style={{ borderBottom: `0.5px solid ${CS.line}`, color: CS.muted }}>
                      Mode
                    </th>
                  ) : null}
                  {show("cost") ? (
                    <QuotationCommercialSummarySortableHead label="Cost" field="cost" align="right" sort={tableSort} onSortChange={setTableSort} />
                  ) : null}
                  {show("revenue") ? (
                    <QuotationCommercialSummarySortableHead label="Revenue" field="revenue" align="right" sort={tableSort} onSortChange={setTableSort} />
                  ) : null}
                  {show("gpPctInput") ? (
                    <th className="px-1 pb-2 pt-2 text-right text-[11px] font-semibold" style={{ borderBottom: `0.5px solid ${CS.line}`, color: CS.muted }}>
                      GP % in
                    </th>
                  ) : null}
                  {show("gp") ? (
                    <QuotationCommercialSummarySortableHead label="GP" field="gp" align="right" sort={tableSort} onSortChange={setTableSort} />
                  ) : null}
                  {show("gpPct") ? (
                    <QuotationCommercialSummarySortableHead label="GP %" field="gpPct" align="right" sort={tableSort} onSortChange={setTableSort} />
                  ) : null}
                  {show("afPct") ? (
                    <th className="px-1 pb-2 pt-2 text-right text-[11px] font-semibold" style={{ borderBottom: `0.5px solid ${CS.line}`, color: CS.muted }}>
                      AF %
                    </th>
                  ) : null}
                  {show("currency") ? (
                    <th className="px-1 pb-2 pt-2 text-right text-[11px] font-semibold" style={{ borderBottom: `0.5px solid ${CS.line}`, color: CS.muted }}>
                      Currency
                    </th>
                  ) : null}
                  {show("fx") ? (
                    <th className="px-1 pb-2 pt-2 text-right text-[11px] font-semibold" style={{ borderBottom: `0.5px solid ${CS.line}`, color: CS.muted }}>
                      FX
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-10 text-center" style={{ color: CS.muted }}>
                      No lines match this filter.
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row) => {
                    const selected = selectedIds.has(row.itemId);
                    const band = resolveProfitabilityBand(row.gpPct);
                    return (
                      <tr key={row.itemId} style={bandStyle(row.gpPct)} className={cn(!selected && "opacity-50")}>
                        <td className="border-t py-1.5 pr-1" style={{ borderColor: CS.line }}>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.itemId)) next.delete(row.itemId);
                                else next.add(row.itemId);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="border-t py-1.5 pr-1.5" style={{ borderColor: CS.line }}>
                          <div className="font-medium">{row.influencerName}</div>
                          <div className="text-[10px]" style={{ color: CS.muted }}>
                            {profitabilityBandLabel(band)}
                            {row.optionLabel ? ` · ${row.optionLabel}` : null}
                          </div>
                        </td>
                        {show("mode") ? (
                          <td className="border-t px-1 py-1" style={{ borderColor: CS.line }}>
                            {canManage ? (
                              <select
                                className="h-7 w-full max-w-[120px] rounded border px-1 text-[11px]"
                                value={row.draft.mode}
                                onChange={(e) => {
                                  const mode = e.target.value as CommercialInputMode;
                                  const next = applyCommercialWorkspaceBulkOp(
                                    { ...row.draft, mode },
                                    mode === "cost_markup_pct"
                                      ? { kind: "apply_markup_pct", pct: row.draft.gpPct }
                                      : { kind: "set_gp_pct", pct: row.draft.gpPct }
                                  );
                                  if (mode === "cost_revenue") {
                                    stageDraft(row.itemId, {
                                      ...row.draft,
                                      mode,
                                      gpValue: row.draft.revenue - row.draft.cost,
                                      gpPct:
                                        row.draft.revenue > 0
                                          ? ((row.draft.revenue - row.draft.cost) /
                                              row.draft.revenue) *
                                            100
                                          : 0,
                                    });
                                  } else {
                                    stageDraft(row.itemId, { ...next, mode: next.mode });
                                  }
                                }}
                              >
                                {MODE_OPTIONS.map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              COMMERCIAL_INPUT_MODE_LABELS[row.draft.mode]
                            )}
                          </td>
                        ) : null}
                        {show("cost") ? (
                          <td className="border-t px-1 py-1 text-right" style={{ borderColor: CS.line }}>
                            {canManage ? (
                              <Input
                                type="number"
                                className="ml-auto h-7 w-[88px] text-right text-xs"
                                value={row.draft.cost}
                                onChange={(e) => {
                                  const cost = Number.isFinite(Number(e.target.value))
                                    ? Number(e.target.value)
                                    : 0;
                                  const revenue = row.draft.revenue;
                                  stageDraft(row.itemId, {
                                    ...row.draft,
                                    mode: "cost_revenue",
                                    cost,
                                    gpValue: revenue - cost,
                                    gpPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
                                  });
                                }}
                              />
                            ) : (
                              <span className="tabular-nums">{fmtCell(row.costEgp)}</span>
                            )}
                          </td>
                        ) : null}
                        {show("revenue") ? (
                          <td className="border-t px-1 py-1 text-right" style={{ borderColor: CS.line }}>
                            {canManage ? (
                              <Input
                                type="number"
                                className="ml-auto h-7 w-[88px] text-right text-xs"
                                value={row.draft.revenue}
                                onChange={(e) => {
                                  const revenue = Number(e.target.value);
                                  stageDraft(row.itemId, {
                                    ...row.draft,
                                    mode: "cost_revenue",
                                    revenue: Number.isFinite(revenue) ? revenue : 0,
                                    gpValue:
                                      (Number.isFinite(revenue) ? revenue : 0) - row.draft.cost,
                                    gpPct:
                                      revenue > 0
                                        ? (((revenue - row.draft.cost) / revenue) * 100)
                                        : 0,
                                  });
                                }}
                              />
                            ) : (
                              <span className="tabular-nums">{fmtCell(row.revenueEgp)}</span>
                            )}
                          </td>
                        ) : null}
                        {show("gpPctInput") ? (
                          <td className="border-t px-1 py-1 text-right" style={{ borderColor: CS.line }}>
                            {canManage ? (
                              <Input
                                type="number"
                                className="ml-auto h-7 w-[72px] text-right text-xs"
                                value={row.draft.gpPct}
                                onChange={(e) => {
                                  const pct = Number(e.target.value);
                                  const next = applyCommercialWorkspaceBulkOp(row.draft, {
                                    kind: "set_gp_pct",
                                    pct: Number.isFinite(pct) ? pct : 0,
                                  });
                                  stageDraft(row.itemId, next);
                                }}
                              />
                            ) : (
                              <span className="tabular-nums">{row.draft.gpPct.toFixed(1)}</span>
                            )}
                          </td>
                        ) : null}
                        {show("gp") ? (
                          <td className="border-t px-1 py-1.5 text-right tabular-nums font-medium" style={{ borderColor: CS.line, color: CS.green }}>
                            {fmtCell(row.gpValueEgp)}
                          </td>
                        ) : null}
                        {show("gpPct") ? (
                          <td className="border-t px-1 py-1.5 text-right tabular-nums font-medium" style={{ borderColor: CS.line, color: CS.green }}>
                            {fmtGpPct(row.gpValueEgp, row.revenueEgp, row.gpPct)}
                          </td>
                        ) : null}
                        {show("afPct") ? (
                          <td className="border-t px-1 py-1 text-right" style={{ borderColor: CS.line }}>
                            {canManage ? (
                              <Input
                                type="number"
                                className="ml-auto h-7 w-[64px] text-right text-xs"
                                value={row.draft.afPct}
                                onChange={(e) => {
                                  const pct = Number(e.target.value);
                                  stageDraft(row.itemId, {
                                    ...row.draft,
                                    afPct: Number.isFinite(pct) ? pct : 0,
                                  });
                                }}
                              />
                            ) : (
                              <span className="tabular-nums">{row.draft.afPct.toFixed(1)}</span>
                            )}
                          </td>
                        ) : null}
                        {show("currency") ? (
                          <td className="border-t px-1 py-1 text-right" style={{ borderColor: CS.line }}>
                            {canManage ? (
                              <Input
                                className="ml-auto h-7 w-[64px] text-right text-xs uppercase"
                                value={row.draft.costCurrency}
                                onChange={(e) => {
                                  stageDraft(
                                    row.itemId,
                                    applyCommercialWorkspaceBulkOp(row.draft, {
                                      kind: "set_currency",
                                      currency: e.target.value || "EGP",
                                    })
                                  );
                                }}
                              />
                            ) : (
                              row.draft.costCurrency
                            )}
                          </td>
                        ) : null}
                        {show("fx") ? (
                          <td className="border-t px-1 py-1 text-right" style={{ borderColor: CS.line }}>
                            {canManage ? (
                              <Input
                                type="number"
                                className="ml-auto h-7 w-[64px] text-right text-xs"
                                value={row.draft.fxRateToEgp}
                                onChange={(e) => {
                                  const fx = Number(e.target.value);
                                  stageDraft(
                                    row.itemId,
                                    applyCommercialWorkspaceBulkOp(row.draft, {
                                      kind: "set_fx",
                                      fxRateToEgp: Number.isFinite(fx) ? fx : 1,
                                    })
                                  );
                                }}
                              />
                            ) : (
                              <span className="tabular-nums">{row.draft.fxRateToEgp}</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage ? (
          <div className="shrink-0 px-5 pb-3 pt-1" style={{ borderTop: `0.5px solid ${CS.line}` }}>
            <UnsavedChangesBar
              isDirty={manualSave.hasUnsavedChanges}
              isSaving={saving || manualSave.savePending}
              onSave={handleSave}
              onCancel={() => setOpen(false)}
              onReset={handleDiscard}
              cancelLabel="Close"
              resetLabel="Discard"
              enableLeaveGuard={false}
              status={
                saving || manualSave.savePending ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2Icon className="size-3 animate-spin" /> Saving via Commercial SSOT…
                  </span>
                ) : null
              }
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
