"use client";

import { FileStackIcon, FileTextIcon, GitBranchIcon, Undo2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { showErrorToastOnce, showSuccessToastOnce } from "@/lib/ui/toast-once";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";

import { Button } from "@/components/ui/button";
import {
  OperationalFloatingActionBar,
  PlatformFloatingBarDivider,
  PlatformFloatingBarPrimaryButton,
  PlatformFloatingBarSecondaryLink,
  PlatformFloatingBarSelection,
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
import { formatMoney } from "@/features/campaigns/utils";
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

export function FloatingSelectionBar({
  campaignId,
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
  onGenerateInvoice,
  onAfterOperationalMutation,
}: FloatingSelectionBarProps) {
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const [pending, startTransition] = useTransition();
  const [ungenerateOpen, setUngenerateOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [ungenerateReason, setUngenerateReason] = useState("");
  const [reviseReason, setReviseReason] = useState("");

  const visible = totals.count > 0;
  const displayCurrency = totals.currencyMixed ? "USD" : (totals.currency ?? "USD");
  const currencyLabel = totals.currencyMixed ? "Mixed" : (totals.currency ?? "USD");
  const primaryAction = vioLineIds.length > 0 ? "vio" : hasInvoiceSelection ? "invoice" : null;

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

  return (
    <>
      <OperationalFloatingActionBar visible={visible} messages={coverageMessages}>
        <PlatformFloatingBarSelection
          selectedCount={totals.count}
          selectionLabel="line"
          onClearSelection={onClearSelection}
          onSelectAll={onSelectAll}
          selectableCount={selectableLineCount}
          busy={pending}
        />

        <PlatformFloatingBarDivider />

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-2 text-xs [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
          <SelectionMetric label="Revenue" value={formatMoney(totals.revenue, displayCurrency)} />
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
          <span className="shrink-0 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {currencyLabel}
          </span>
        </div>

        <PlatformFloatingBarDivider className="ml-auto" />

        <div className="flex shrink-0 items-center gap-1 pl-2">
          {vioLineIds.length > 0 ? (
            primaryAction === "vio" ? (
              <PlatformFloatingBarPrimaryButton
                busy={pending}
                action={{
                  id: "vio",
                  label: pending ? "Generating…" : "Generate Vendor IO",
                  icon: FileStackIcon,
                  disabled: pending,
                  onClick: runVioGenerate,
                }}
              />
            ) : (
              <PlatformFloatingBarSecondaryLink
                busy={pending}
                action={{
                  id: "vio",
                  label: "Generate Vendor IO",
                  icon: FileStackIcon,
                  disabled: pending,
                  onClick: runVioGenerate,
                }}
              />
            )
          ) : null}
          {reviseVioLineIds.length > 0 ? (
            <PlatformFloatingBarSecondaryLink
              action={{
                id: "revise",
                label: "Revise Vendor IO",
                icon: GitBranchIcon,
                onClick: () => setReviseOpen(true),
              }}
            />
          ) : null}
          {ungenerateIoLineIds.length > 0 ? (
            <PlatformFloatingBarSecondaryLink
              action={{
                id: "ungenerate",
                label: "Ungenerate IO",
                icon: Undo2Icon,
                onClick: () => setUngenerateOpen(true),
              }}
            />
          ) : null}
          {hasInvoiceSelection ? (
            primaryAction === "invoice" ? (
              <PlatformFloatingBarPrimaryButton
                action={{
                  id: "invoice",
                  label:
                    invoiceActionLabel === "regenerate"
                      ? "Regenerate invoice"
                      : "Generate invoice",
                  icon: FileTextIcon,
                  disabled: ioCoverage?.case === "blocked",
                  onClick: onGenerateInvoice,
                }}
              />
            ) : (
              <PlatformFloatingBarSecondaryLink
                action={{
                  id: "invoice",
                  label:
                    invoiceActionLabel === "regenerate"
                      ? "Regenerate invoice"
                      : "Generate invoice",
                  icon: FileTextIcon,
                  disabled: ioCoverage?.case === "blocked",
                  onClick: onGenerateInvoice,
                }}
              />
            )
          ) : null}
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
