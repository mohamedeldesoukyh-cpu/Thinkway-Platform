"use client";

import { FileStackIcon, FileTextIcon, GitBranchIcon, Undo2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { showErrorToastOnce, showSuccessToastOnce } from "@/lib/ui/toast-once";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";

import { Button } from "@/components/ui/button";
import {
  OperationalFloatingActionBar,
} from "@/components/workspace/operational-floating-action-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  generateVendorIosFromLinesAction,
  type GenerateVendorIoState,
} from "@/features/io/generate-vendor-io-action";
import {
  reviseVendorIosFromLinesAction,
  type ReviseVendorIoState,
} from "@/features/io/revise-vendor-io-action";
import {
  ungenerateVendorIosFromLinesAction,
  type UngenerateVendorIoState,
} from "@/features/io/ungenerate-vendor-io-action";
import { formatMoneyKpi } from "@/lib/campaigns/utils";
import type { IoCoverageAnalysis } from "@/lib/operations/io-coverage";
import { cn } from "@/lib/utils";

const initialVioState: GenerateVendorIoState = { ok: false };
const initialReviseState: ReviseVendorIoState = { ok: false };
const initialUngenerateState: UngenerateVendorIoState = { ok: false };

export type AssignmentSelectionTotals = {
  count: number;
  revenue: number;
  cost: number;
  gp: number;
  totalBilling: number;
  deliverables: number;
  currency: string | null;
  currencyMixed: boolean;
};

type FloatingSelectionBarProps = {
  campaignId: string;
  totals: AssignmentSelectionTotals;
  selectedLineIds: string[];
  selectableLineCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  vioLineIds: string[];
  reviseVioLineIds: string[];
  ungenerateIoLineIds: string[];
  invoiceLineIds: string[];
  hasInvoiceSelection?: boolean;
  invoiceActionLabel?: "generate" | "regenerate" | null;
  invoicePending?: boolean;
  ioCoverage?: IoCoverageAnalysis | null;
  onGenerateInvoice: () => void;
  onAfterOperationalMutation?: () => void;
};

function buildFormData(
  campaignId: string,
  lineIds: string[],
  reason?: string
): FormData {
  const fd = new FormData();
  fd.set("campaign_id", campaignId);
  fd.set("line_ids", lineIds.join(","));
  if (reason != null) fd.set("reason", reason);
  return fd;
}

/** Stacked metric cell — matches campaign-detail.html `.tw-selbar .sum > span`. */
function SelectionMetric({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone?: "ok";
  className?: string;
}) {
  return (
    <span className={cn("tw-selbar-metric", className)}>
      <i>{label}</i>
      <b className={tone === "ok" ? "g" : undefined}>{value}</b>
    </span>
  );
}

export function FloatingSelectionBar({
  campaignId,
  totals,
  selectedLineIds: _selectedLineIds,
  selectableLineCount,
  onSelectAll,
  onClearSelection,
  vioLineIds,
  reviseVioLineIds,
  ungenerateIoLineIds,
  invoiceLineIds,
  hasInvoiceSelection = invoiceLineIds.length > 0,
  invoiceActionLabel = "generate",
  invoicePending = false,
  ioCoverage = null,
  onGenerateInvoice,
  onAfterOperationalMutation,
}: FloatingSelectionBarProps) {
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const [pending, startTransition] = useTransition();
  const [ungenerateOpen, setUngenerateOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [ungenerateReason, setUngenerateReason] = useState("");
  const [reviseReason, setReviseReason] = useState("");

  const busy = pending;
  const visible = totals.count > 0;
  const displayCurrency = totals.currencyMixed ? "USD" : (totals.currency ?? "USD");
  const primaryAction = vioLineIds.length > 0 ? "vio" : hasInvoiceSelection ? "invoice" : null;
  const showSelectAll =
    selectableLineCount > 0 && totals.count < selectableLineCount;

  function runVioGenerate() {
    startTransition(async () => {
      const result = await generateVendorIosFromLinesAction(
        initialVioState,
        buildFormData(campaignId, vioLineIds)
      );
      if (result.ok) {
        showSuccessToastOnce(result.message ?? "Vendor IO generated.", {
          id: "assignment-vio-generate",
        });
        onAfterOperationalMutation?.();
        refreshAfterOperationalMutation();
      } else {
        showErrorToastOnce(result.message ?? "Vendor IO generation failed.", {
          id: "assignment-vio-generate",
        });
      }
    });
  }

  function runRevise() {
    const reason = reviseReason.trim();
    if (reason.length < 3) return;
    startTransition(async () => {
      const result = await reviseVendorIosFromLinesAction(
        initialReviseState,
        buildFormData(campaignId, reviseVioLineIds, reason)
      );
      if (result.ok) {
        showSuccessToastOnce(result.message ?? "Vendor IO revised.", {
          id: "assignment-vio-revise",
        });
        setReviseOpen(false);
        setReviseReason("");
        onAfterOperationalMutation?.();
        refreshAfterOperationalMutation();
      } else {
        showErrorToastOnce(result.message ?? "Revise Vendor IO failed.", {
          id: "assignment-vio-revise",
        });
      }
    });
  }

  function runUngenerate() {
    const reason = ungenerateReason.trim();
    if (reason.length < 3) return;
    startTransition(async () => {
      const result = await ungenerateVendorIosFromLinesAction(
        initialUngenerateState,
        buildFormData(campaignId, ungenerateIoLineIds, reason)
      );
      if (result.ok) {
        showSuccessToastOnce(result.message ?? "Vendor IO un-generated.", {
          id: "assignment-vio-ungenerate",
        });
        setUngenerateOpen(false);
        setUngenerateReason("");
        onAfterOperationalMutation?.();
        refreshAfterOperationalMutation();
      } else {
        showErrorToastOnce(result.message ?? "Un-generate failed.", {
          id: "assignment-vio-ungenerate",
        });
      }
    });
  }

  const coverageMessages =
    ioCoverage?.case === "revision_warning" && ioCoverage.warning_message ? (
      <p className="text-xs text-amber-800 dark:text-amber-200">{ioCoverage.warning_message}</p>
    ) : ioCoverage?.case === "blocked" && ioCoverage.block_message ? (
      <p className="text-xs text-destructive">{ioCoverage.block_message}</p>
    ) : null;

  const invoiceLabel = invoicePending
    ? "Generating…"
    : invoiceActionLabel === "regenerate"
      ? "Regenerate invoice"
      : "Generate invoice";

  return (
    <>
      <OperationalFloatingActionBar
        visible={visible}
        messages={coverageMessages}
        className="tw-selbar"
      >
        <span className="tw-selbar-n">
          <b>{totals.count}</b>
          of {selectableLineCount > 0 ? selectableLineCount : totals.count} lines selected
          <button
            type="button"
            className="tw-selbar-x"
            onClick={onClearSelection}
            aria-label="Clear selection"
            disabled={busy}
          >
            ✕
          </button>
          {showSelectAll ? (
            <button
              type="button"
              className="tw-selbar-all"
              onClick={onSelectAll}
              disabled={busy}
            >
              Select all
            </button>
          ) : null}
        </span>

        <span className="tw-selbar-sum">
          <SelectionMetric label="Revenue" value={formatMoneyKpi(totals.revenue, displayCurrency)} />
          <SelectionMetric
            label="Cost"
            value={formatMoneyKpi(totals.cost, displayCurrency)}
            className="hidden sm:flex"
          />
          <SelectionMetric
            label="GP"
            value={formatMoneyKpi(totals.gp, displayCurrency)}
            tone="ok"
            className="hidden md:flex"
          />
          <SelectionMetric
            label="Total billing"
            value={formatMoneyKpi(totals.totalBilling, displayCurrency)}
            className="hidden lg:flex"
          />
          <SelectionMetric
            label="Deliverables"
            value={String(totals.deliverables)}
            className="hidden md:flex"
          />
        </span>

        <span className="tw-selbar-acts">
          {vioLineIds.length > 0 ? (
            <button
              type="button"
              className={cn("tw-selbar-btn", primaryAction === "vio" && "pri")}
              disabled={pending}
              onClick={runVioGenerate}
            >
              <FileStackIcon className="size-3.5" aria-hidden />
              {pending ? "Generating…" : "Generate Vendor IO"}
            </button>
          ) : null}
          {reviseVioLineIds.length > 0 ? (
            <button
              type="button"
              className="tw-selbar-btn"
              onClick={() => setReviseOpen(true)}
            >
              <GitBranchIcon className="size-3.5" aria-hidden />
              Revise Vendor IO
            </button>
          ) : null}
          {ungenerateIoLineIds.length > 0 ? (
            <button
              type="button"
              className="tw-selbar-btn"
              onClick={() => setUngenerateOpen(true)}
            >
              <Undo2Icon className="size-3.5" aria-hidden />
              Ungenerate IO
            </button>
          ) : null}
          {hasInvoiceSelection ? (
            <button
              type="button"
              className={cn("tw-selbar-btn", primaryAction === "invoice" && "pri")}
              disabled={invoicePending || ioCoverage?.case === "blocked"}
              onClick={onGenerateInvoice}
            >
              <FileTextIcon className="size-3.5" aria-hidden />
              {invoiceLabel}
            </button>
          ) : null}
        </span>
      </OperationalFloatingActionBar>

      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revise Vendor IO</DialogTitle>
            <DialogDescription>
              Vendor IO will be revised using the same IO number for {reviseVioLineIds.length}{" "}
              line{reviseVioLineIds.length === 1 ? "" : "s"} (internal revision /n).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="floating_vio_revise_reason">Correction reason (required)</Label>
              <Textarea
                id="floating_vio_revise_reason"
                value={reviseReason}
                onChange={(e) => setReviseReason(e.target.value)}
                rows={3}
                placeholder="Post-invoice correction…"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReviseOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={pending || reviseReason.trim().length < 3}
                onClick={runRevise}
              >
                {pending ? "Creating revision…" : "Create revision"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ungenerateOpen} onOpenChange={setUngenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Un-generate Vendor IO</DialogTitle>
            <DialogDescription>
              Return {ungenerateIoLineIds.length} line(s) to draft (not allowed when invoiced).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="floating_vio_ungenerate_reason">Reason (required)</Label>
              <Textarea
                id="floating_vio_ungenerate_reason"
                value={ungenerateReason}
                onChange={(e) => setUngenerateReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUngenerateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending || ungenerateReason.trim().length < 3}
                onClick={runUngenerate}
              >
                {pending ? "Un-generating…" : "Confirm un-generate"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
