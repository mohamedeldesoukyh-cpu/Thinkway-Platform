"use client";

import { FileStackIcon, FileTextIcon, GitBranchIcon, Undo2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { cn } from "@/lib/utils";

const initialVioState: GenerateVendorIoState = { ok: false };
const initialReviseState: ReviseVendorIoState = { ok: false };
const initialUngenerateState: UngenerateVendorIoState = { ok: false };

type AssignmentSafeActionsFooterProps = {
  campaignId: string;
  currency: string;
  selectedLineIds: string[];
  selectableLineCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  vioLineIds: string[];
  reviseVioLineIds: string[];
  ungenerateIoLineIds: string[];
  invoiceLineIds: string[];
  invoiceTotal: number;
  onGenerateInvoice: (lineIds: string[]) => void;
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

export function AssignmentSafeActionsFooter({
  campaignId,
  currency,
  selectedLineIds,
  selectableLineCount,
  onSelectAll,
  onClearSelection,
  vioLineIds,
  reviseVioLineIds,
  ungenerateIoLineIds,
  invoiceLineIds,
  invoiceTotal,
  onGenerateInvoice,
  onAfterOperationalMutation,
  className,
}: AssignmentSafeActionsFooterProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ungenerateOpen, setUngenerateOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [ungenerateReason, setUngenerateReason] = useState("");
  const [reviseReason, setReviseReason] = useState("");

  const hasSelection = selectedLineIds.length > 0;

  function runVioGenerate() {
    startTransition(async () => {
      const result = await generateVendorIosFromLinesAction(
        initialVioState,
        buildFormData(campaignId, vioLineIds)
      );
      if (result.ok) {
        toast.success(result.message);
        onAfterOperationalMutation?.();
        router.refresh();
      } else toast.error(result.message ?? "Vendor IO generation failed.");
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
        toast.success(result.message);
        setReviseOpen(false);
        setReviseReason("");
        onAfterOperationalMutation?.();
        router.refresh();
      } else toast.error(result.message ?? "Revise Vendor IO failed.");
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
        toast.success(result.message);
        setUngenerateOpen(false);
        setUngenerateReason("");
        onAfterOperationalMutation?.();
        router.refresh();
      } else toast.error(result.message ?? "Un-generate failed.");
    });
  }

  return (
    <div
      className={cn(
        "sticky bottom-2 flex flex-col gap-2",
        "rounded-xl border border-border/60 bg-background/95 px-3 py-2.5 text-sm shadow-md backdrop-blur",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={selectableLineCount === 0}
            onClick={onSelectAll}
          >
            Select all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={!hasSelection}
            onClick={onClearSelection}
          >
            Clear
          </Button>
          <span className="text-xs text-muted-foreground">
            {hasSelection ? (
              <>
                <span className="font-medium text-foreground">{selectedLineIds.length}</span>{" "}
                selected
                {invoiceLineIds.length > 0 ? (
                  <> · Invoice {formatMoney(invoiceTotal, currency)}</>
                ) : null}
              </>
            ) : (
              <>Select assignments for Vendor IO or invoice actions</>
            )}
          </span>
        </div>
        {hasSelection ? (
          <div className="flex flex-wrap gap-2">
            {vioLineIds.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={runVioGenerate}
              >
                <FileStackIcon data-icon="inline-start" />
                {pending ? "Generating…" : "Generate Vendor IO"}
              </Button>
            ) : null}
            {reviseVioLineIds.length > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setReviseOpen(true)}>
                <GitBranchIcon data-icon="inline-start" />
                Revise Vendor IO
              </Button>
            ) : null}
            {ungenerateIoLineIds.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setUngenerateOpen(true)}
              >
                <Undo2Icon data-icon="inline-start" />
                Ungenerate IO
              </Button>
            ) : null}
            {invoiceLineIds.length > 0 ? (
              <Button type="button" size="sm" onClick={() => onGenerateInvoice(invoiceLineIds)}>
                <FileTextIcon data-icon="inline-start" />
                Generate invoice
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revise Vendor IO</DialogTitle>
            <DialogDescription>
              Create a new VIO revision for {reviseVioLineIds.length} line
              {reviseVioLineIds.length === 1 ? "" : "s"}.
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
    </div>
  );
}
