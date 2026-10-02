"use client";

import { useState } from "react";
import { CalculatorIcon, DownloadIcon, FileTextIcon } from "lucide-react";
import { PlatformFloatingBarShell, PlatformFloatingBarOverflowMenu } from "@/components/shared/navigation/platform-floating-action-bar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBillingMoney } from "@/features/billing/utils";

export function BillingSelectionBar({ count, total, onClear, onSelectAll, onGenerate, pending = false, onPercent, onReview, summary, onExport }: {
  count: number; total: number; onClear: () => void; onSelectAll: () => void;
  onGenerate?: () => void; pending?: boolean; onPercent?: (percent: number) => void;
  onReview?: () => void; onExport?: () => void;
  summary?: { currency: string; beforeVat: number; vat: number; total: number; remaining: number };
}) {
  const [calculator, setCalculator] = useState(false);
  const [percent, setPercent] = useState("50");
  const valid = percent.trim() !== "" && Number.isFinite(Number(percent)) && Number(percent) >= 0 && Number(percent) <= 100;
  if (!count) return null;
  return <>
    <PlatformFloatingBarShell visible className="tw-selbar [&_.platform-floating-bar]:!bg-[#0b0f1a] [&_.platform-floating-bar]:!text-white" messages={summary ? <div className="rounded-xl border bg-background px-4 py-2 text-xs shadow-sm" aria-live="polite">
      Selected: <b>{formatBillingMoney(summary.beforeVat, summary.currency)}</b> · VAT: {formatBillingMoney(summary.vat, summary.currency)} · Total: <b>{formatBillingMoney(summary.total, summary.currency)}</b> · Remaining: {formatBillingMoney(summary.remaining, summary.currency)}
    </div> : null}>
      <span className="tw-selbar-n inline-flex items-center gap-2 px-3 py-2 text-xs text-white whitespace-nowrap"><b>{count}</b> of {total} selected
        <button type="button" className="tw-selbar-x" aria-label="Clear billing selection" disabled={pending} onClick={onClear}>✕</button>
        <button type="button" className="tw-selbar-all" disabled={pending} onClick={onSelectAll}>Select all</button>
      </span>
      <span className="tw-selbar-acts ml-auto flex items-center gap-2 px-3 py-2">
        {onPercent && <button type="button" className="tw-selbar-btn inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white whitespace-nowrap" disabled={pending} onClick={() => setCalculator(true)}><CalculatorIcon className="size-3.5" />Set invoice %</button>}
        {onReview && <button type="button" className="tw-selbar-btn inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white whitespace-nowrap" disabled={pending} onClick={onReview}>Review selected rows</button>}
        {onGenerate && <button type="button" className="tw-selbar-btn pri inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs text-blue-700 whitespace-nowrap" disabled={pending} onClick={onGenerate}><FileTextIcon className="size-3.5" />{pending ? "Generating…" : "Generate invoice"}</button>}
        <PlatformFloatingBarOverflowMenu busy={pending} className="tw-selbar-btn inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white whitespace-nowrap" actions={[
          ...(onPercent ? [{ id: "remaining", label: "Invoice remaining balance", onClick: () => onPercent(100) }] : []),
          ...(onExport ? [{ id: "export", label: "Export selected amounts", icon: DownloadIcon, onClick: onExport }] : []),
          { id: "clear", label: "Clear selection", onClick: onClear },
        ]} />
      </span>
    </PlatformFloatingBarShell>
    <Dialog open={calculator} onOpenChange={setCalculator}>
      <DialogContent>
        <DialogHeader><DialogTitle>Invoice percentage calculator</DialogTitle><DialogDescription>Apply a percentage of the original billable amount to selected rows only. Each amount is capped at its remaining balance. The selection totals update after applying.</DialogDescription></DialogHeader>
        <label className="space-y-2 text-sm">Invoice %<input aria-label="Selected invoice percentage" type="number" min={0} max={100} step="0.01" value={percent} onChange={e => setPercent(e.target.value)} className="block w-full rounded-lg border px-3 py-2" /></label>
        <div className="flex gap-2">{[25, 50, 75, 100].map(value => <Button key={value} type="button" variant="outline" onClick={() => setPercent(String(value))}>{value}%</Button>)}</div>
        <DialogFooter><Button variant="outline" onClick={() => setCalculator(false)}>Cancel</Button><Button disabled={!valid || pending} onClick={() => { onPercent?.(Number(percent)); setCalculator(false); }}>Apply to {count} selected</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

export function downloadBillingSelection(rows: Array<{ label: string; percent: number; amount: number; vat: number; total: number }>, currency: string) {
  const cell = (value: string | number) => `"${String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  const csv = [["Line", "Invoice %", "Currency", "Before VAT", "VAT", "Total"], ...rows.map(row => [row.label, row.percent, currency, row.amount, row.vat, row.total])].map(row => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "selected-client-invoice-amounts.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
