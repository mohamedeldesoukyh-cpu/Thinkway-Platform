"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InvoiceTargetMode } from "@/features/billing/components/invoice-target-choice-dialog";
import type { AppendableInvoiceOption } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { isAppendableInvoiceStatus } from "@/lib/billing/invoice-status";
import type { InvoiceConfirmLinePreview } from "@/lib/billing/operational-invoice-draft";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";

export type InvoiceConfirmCampaignPreview = {
  campaignId: string;
  campaignName: string;
  campaignNo: string;
  currency: string;
  campaignTotal: number;
  alreadyInvoiced: number;
  thisInvoice: number;
  thisInvoiceVat: number;
  thisInvoiceTotal: number;
  remainingAfter: number;
  lines: InvoiceConfirmLinePreview[];
};

type InvoiceConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: InvoiceConfirmCampaignPreview[];
  appendableInvoices?: AppendableInvoiceOption[];
  pending?: boolean;
  onConfirm: (mode: InvoiceTargetMode, existingInvoiceId?: string) => void;
};

function lineLabel(line: InvoiceConfirmLinePreview): string {
  return line.influencerName?.trim() || line.label;
}

export function InvoiceConfirmDialog({
  open,
  onOpenChange,
  campaigns,
  appendableInvoices = [],
  pending = false,
  onConfirm,
}: InvoiceConfirmDialogProps) {
  const bulk = campaigns.length > 1;
  const single = campaigns[0] ?? null;
  const eligible = bulk
    ? []
    : appendableInvoices.filter(
        (inv) =>
          !inv.is_locked &&
          isAppendableInvoiceStatus(inv.status) &&
          inv.status !== "paid"
      );
  const eligibleKey = eligible.map((inv) => inv.id).join(",");

  const [mode, setMode] = useState<InvoiceTargetMode>("new");
  const [existingInvoiceId, setExistingInvoiceId] = useState("");

  useEffect(() => {
    if (!open) {
      setMode("new");
      setExistingInvoiceId("");
      return;
    }
    setMode("new");
    setExistingInvoiceId(eligible[0]?.id ?? "");
  }, [open, eligibleKey]);

  const mixedCurrency = new Set(campaigns.map((row) => row.currency)).size > 1;
  const tableLines = campaigns.flatMap((campaign) =>
    campaign.lines.map((line) => ({ campaign, line }))
  );
  const showTable = bulk || tableLines.length > 1;

  function handleProceed() {
    if (mode === "append") {
      if (!existingInvoiceId) return;
      onConfirm("append", existingInvoiceId);
      return;
    }
    onConfirm("new");
  }

  const proceedDisabled =
    pending || campaigns.length === 0 || (mode === "append" && !existingInvoiceId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{bulk ? "Confirm bulk invoice" : "Confirm invoice"}</DialogTitle>
          <DialogDescription>
            {bulk
              ? `${campaigns.length} campaigns will each get a new invoice. Review the amounts, then proceed or cancel.`
              : single
                ? `${single.campaignName} · ${formatDocumentNumberForDisplay(single.campaignNo)}. Review the amounts, then proceed or cancel.`
                : "Review the amounts, then proceed or cancel."}
          </DialogDescription>
        </DialogHeader>

        {single && !bulk ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ConfirmStat
              label="Total"
              value={formatBillingMoney(single.campaignTotal, single.currency)}
            />
            <ConfirmStat
              label="Invoiced"
              value={formatBillingMoney(single.alreadyInvoiced, single.currency)}
            />
            <ConfirmStat
              label="This invoice"
              value={formatBillingMoney(single.thisInvoice, single.currency)}
              emphasis
            />
            <ConfirmStat
              label="Remaining after"
              value={formatBillingMoney(single.remainingAfter, single.currency)}
            />
          </div>
        ) : null}

        {showTable ? (
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-muted/80 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                <tr>
                  {bulk ? <th className="px-2 py-1.5">Campaign</th> : null}
                  <th className="px-2 py-1.5">Line</th>
                  <th className="px-2 py-1.5">Ref</th>
                  <th className="px-2 py-1.5 text-right">This invoice</th>
                  <th className="px-2 py-1.5 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {tableLines.map(({ campaign, line }) => (
                  <tr key={`${campaign.campaignId}:${line.id}`} className="border-t border-border/70">
                    {bulk ? (
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{campaign.campaignName}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatDocumentNumberForDisplay(campaign.campaignNo)}
                        </div>
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5">{lineLabel(line)}</td>
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                      {formatDocumentNumberForDisplay(line.documentNumber)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatBillingMoney(line.toBeInvoiced, campaign.currency)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatBillingMoney(line.remaining, campaign.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {mixedCurrency ? (
          <p className="text-[11px] text-muted-foreground">
            Amounts stay in each campaign currency and are not added together.
          </p>
        ) : null}

        {eligible.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label htmlFor="invoice-confirm-target">Invoice target</Label>
            <Select
              value={mode === "append" ? existingInvoiceId : "new"}
              onValueChange={(value) => {
                if (value === "new") {
                  setMode("new");
                  return;
                }
                setMode("append");
                setExistingInvoiceId(value);
              }}
            >
              <SelectTrigger id="invoice-confirm-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create new invoice</SelectItem>
                {eligible.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    Add to {formatDocumentNumberForDisplay(inv.document_number)} ·{" "}
                    {formatBillingMoney(inv.total, inv.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleProceed} disabled={proceedDisabled}>
            {pending ? "Generating…" : "Proceed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmStat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={emphasis ? "text-sm font-semibold tabular-nums text-[#1D9E75]" : "text-sm font-semibold tabular-nums"}>
        {value}
      </div>
    </div>
  );
}
