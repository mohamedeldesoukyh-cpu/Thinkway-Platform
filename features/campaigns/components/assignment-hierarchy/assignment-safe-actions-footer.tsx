"use client";

import { FileStackIcon, FileTextIcon, GitBranchIcon, Undo2Icon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { showErrorToastOnce, showSuccessToastOnce } from "@/lib/ui/toast-once";

import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { OperationalFloatingActionBar } from "@/components/workspace/operational-floating-action-bar";
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
import { formatMoney } from "@/features/campaigns/utils";
import type { AssignmentSelectionTotals } from "@/features/campaigns/components/assignment-hierarchy/assignment-selection-summary-bar";
import type { IoCoverageAnalysis } from "@/lib/operations/io-coverage";
import { cn } from "@/lib/utils";

const initialVioState: GenerateVendorIoState = { ok: false };
const initialReviseState: ReviseVendorIoState = { ok: false };
const initialUngenerateState: UngenerateVendorIoState = { ok: false };

type AssignmentSafeActionsFooterProps = {
  campaignId: string;
  currency: string;
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
  ioCoverage?: IoCoverageAnalysis | null;
  invoiceTotal: number;
  onGenerateInvoice: () => void;
  /** Clear selection / expansion before router.refresh after IO mutations. */
  onAfterOperationalMutation?: () => void;
  className?: string;
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

function SelectionMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <span className={cn("shrink-0 tabular-nums text-foreground", className)}>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-semibold">{value}</span>
    </span>
  );
}

export function AssignmentSafeActionsFooter({
  campaignId,
  currency,
  totals,
  selectedLineIds,
  selectableLineCount,
  onSelectAll,
  onClearSelection,
  vioLineIds,
  reviseVioLineIds,
  ungenerateIoLineIds,
  invoiceLineIds,
  hasInvoiceSelection = invoiceLineIds.length > 0,
  invoiceActionLabel = "generate",
  ioCoverage = null,
  invoiceTotal: _invoiceTotal,
  onGenerateInvoice,
  onAfterOperationalMutation,
  className,
}: AssignmentSafeActionsFooterProps) {
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const [pending, startTransition] = useTransition();
  const [ungenerateOpen, setUngenerateOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [ungenerateReason, setUngenerateReason] = useState("");
  const [reviseReason, setReviseReason] = useState("");

  const hasSelection = selectedLineIds.length > 0;
  const displayCurrency = totals.currencyMixed ? "USD" : (totals.currency ?? currency ?? "USD");
  const currencyLabel = totals.currencyMixed ? "Mixed" : (totals.currency ?? currency ?? "USD");
  const primaryAction = vioLineIds.length > 0 ? "vio" : hasInvoiceSelection ? "invoice" : null;

  function runVioGenerate() {
    startTransition(async () => {
      const result = await generateVendorIosFromLinesAction(
        initialVioState,
        buildFormData(campaignId, vioLineIds)
      );
      if (result.ok) {
        showSuccessToastOnce(result.message ?? "Vendor IO generated.", {
          id: "assignment-safe-vio",
        });
        onAfterOperationalMutation?.();
        refreshAfterOperationalMutation();
      } else {
        showErrorToastOnce(result.message ?? "Vendor IO generation failed.", {
          id: "assignment-safe-vio",
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
        if (process.env.NODE_ENV === "development") {
          console.log("[Assignments] revise Vendor IO success", {
            revised_line_ids: result.revised_line_ids,
            new_vendor_io_ids: result.new_vendor_io_ids,
          });
        }
        showSuccessToastOnce(result.message ?? "Vendor IO revised.", {
          id: "assignment-safe-revise",
        });
        setReviseOpen(false);
        setReviseReason("");
        onAfterOperationalMutation?.();
        refreshAfterOperationalMutation();
      } else {
        showErrorToastOnce(result.message ?? "Revise Vendor IO failed.", {
          id: "assignment-safe-revise",
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
          id: "assignment-safe-ungenerate",
        });
        setUngenerateOpen(false);
        setUngenerateReason("");
        onAfterOperationalMutation?.();
        refreshAfterOperationalMutation();
      } else {
        showErrorToastOnce(result.message ?? "Un-generate failed.", {
          id: "assignment-safe-ungenerate",
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

  return (
    <>
      <OperationalFloatingActionBar
        visible={hasSelection}
        messages={coverageMessages}
        className={className}
      >
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto text-xs [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
            <div className="flex shrink-0 items-center gap-1.5 pr-1">
              <Badge
                variant="secondary"
                className="h-6 shrink-0 rounded-full px-2.5 text-[11px] font-semibold"
              >
                {totals.count} selected
              </Badge>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="size-6 shrink-0 rounded-full text-muted-foreground"
                disabled={!hasSelection}
                onClick={onClearSelection}
                aria-label="Clear selection"
              >
                <XIcon className="size-3.5" />
              </Button>
              {selectableLineCount > 0 ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="hidden shrink-0 sm:inline-flex"
                  onClick={onSelectAll}
                >
                  Select all
                </Button>
              ) : null}
            </div>

            <div className="hidden h-5 w-px shrink-0 bg-border/70 sm:block" aria-hidden />

            <SelectionMetric
              label="Revenue"
              value={formatMoney(totals.revenue, displayCurrency)}
            />
            <SelectionMetric
              label="Cost"
              value={formatMoney(totals.cost, displayCurrency)}
              className="hidden sm:inline"
            />
            <SelectionMetric
              label="GP"
              value={formatMoney(totals.gp, displayCurrency)}
              className="hidden md:inline [&_span:last-child]:text-primary"
            />
            <SelectionMetric
              label="Total billing"
              value={formatMoney(totals.totalBilling, displayCurrency)}
              className="hidden lg:inline"
            />
            <Badge variant="outline" className="h-5 shrink-0 text-[10px] font-medium">
              {currencyLabel}
            </Badge>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:border-l sm:border-border/70 sm:pl-2">
          {vioLineIds.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant={primaryAction === "vio" ? "default" : "outline"}
              className="h-8 shrink-0 rounded-full text-xs"
              disabled={pending}
              onClick={runVioGenerate}
            >
              <FileStackIcon data-icon="inline-start" />
              {pending ? "Generating…" : "Generate Vendor IO"}
            </Button>
          ) : null}
          {reviseVioLineIds.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 rounded-full text-xs"
              onClick={() => setReviseOpen(true)}
            >
              <GitBranchIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Revise Vendor IO</span>
              <span className="sm:hidden">Revise IO</span>
            </Button>
          ) : null}
          {ungenerateIoLineIds.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 rounded-full text-xs"
              onClick={() => setUngenerateOpen(true)}
            >
              <Undo2Icon data-icon="inline-start" />
              <span className="hidden sm:inline">Ungenerate IO</span>
              <span className="sm:hidden">Ungenerate</span>
            </Button>
          ) : null}
          {hasInvoiceSelection ? (
            <Button
              type="button"
              size="sm"
              variant={primaryAction === "invoice" ? "default" : "outline"}
              className="h-8 shrink-0 rounded-full text-xs"
              disabled={ioCoverage?.case === "blocked"}
              onClick={onGenerateInvoice}
            >
              <FileTextIcon data-icon="inline-start" />
              {invoiceActionLabel === "regenerate" ? (
                <>
                  <span className="hidden sm:inline">Regenerate invoice</span>
                  <span className="sm:hidden">Regenerate</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Generate invoice</span>
                  <span className="sm:hidden">Invoice</span>
                </>
              )}
            </Button>
          ) : null}
          </div>
        </div>
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
              <Label htmlFor="assignment_vio_revise_reason">Correction reason (required)</Label>
              <Textarea
                id="assignment_vio_revise_reason"
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
              <Label htmlFor="assignment_vio_ungenerate_reason">Reason (required)</Label>
              <Textarea
                id="assignment_vio_ungenerate_reason"
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
