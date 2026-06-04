"use client";

import { FileStackIcon, FileTextIcon, GitBranchIcon, Undo2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
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

type AssignmentOperationalActionsFooterProps = {
  campaignId: string;
  currency: string;
  selectedLineIds: string[];
  vioLineIds: string[];
  reviseVioLineIds: string[];
  ungenerateIoLineIds: string[];
  invoiceLineIds: string[];
  invoiceTotal: number;
  onGenerateInvoice: (lineIds: string[]) => void;
  className?: string;
};

const initialVioState: GenerateVendorIoState = { ok: false };
const initialReviseState: ReviseVendorIoState = { ok: false };
const initialUngenerateState: UngenerateVendorIoState = { ok: false };

export function AssignmentOperationalActionsFooter({
  campaignId,
  currency,
  selectedLineIds,
  vioLineIds,
  reviseVioLineIds,
  ungenerateIoLineIds,
  invoiceLineIds,
  invoiceTotal,
  onGenerateInvoice,
  className,
}: AssignmentOperationalActionsFooterProps) {
  const router = useRouter();
  const [ungenerateOpen, setUngenerateOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [ungenerateReason, setUngenerateReason] = useState("");
  const [reviseReason, setReviseReason] = useState("");
  const [vioState, vioAction, vioPending] = useActionState(
    generateVendorIosFromLinesAction,
    initialVioState
  );
  const [reviseState, reviseAction, revisePending] = useActionState(
    reviseVendorIosFromLinesAction,
    initialReviseState
  );
  const [ungenerateState, ungenerateAction, ungeneratePending] = useActionState(
    ungenerateVendorIosFromLinesAction,
    initialUngenerateState
  );

  useEffect(() => {
    if (!vioState.message) return;
    if (vioState.ok) {
      toast.success(vioState.message);
      router.refresh();
    } else toast.error(vioState.message);
  }, [vioState, router]);

  useEffect(() => {
    if (!reviseState.message) return;
    if (reviseState.ok) {
      toast.success(reviseState.message);
      setReviseOpen(false);
      setReviseReason("");
      router.refresh();
    } else toast.error(reviseState.message);
  }, [reviseState, router]);

  useEffect(() => {
    if (!ungenerateState.message) return;
    if (ungenerateState.ok) {
      toast.success(ungenerateState.message);
      setUngenerateOpen(false);
      setUngenerateReason("");
      router.refresh();
    } else toast.error(ungenerateState.message);
  }, [ungenerateState, router]);

  if (selectedLineIds.length === 0) return null;

  return (
    <div
      className={cn(
        "sticky bottom-2 flex flex-wrap items-center justify-between gap-3",
        "rounded-xl border bg-background/95 px-3 py-2.5 text-sm shadow-sm backdrop-blur",
        className
      )}
    >
      <div className="text-muted-foreground">
        <span className="font-medium text-foreground">{selectedLineIds.length}</span> assignment
        {selectedLineIds.length === 1 ? "" : "s"} selected
        {invoiceLineIds.length > 0 ? (
          <>
            {" "}
            · Invoice {formatMoney(invoiceTotal, currency)}
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {vioLineIds.length > 0 ? (
          <form action={vioAction}>
            <input type="hidden" name="campaign_id" value={campaignId} />
            <input type="hidden" name="line_ids" value={vioLineIds.join(",")} />
            <Button type="submit" size="sm" variant="outline" disabled={vioPending}>
              <FileStackIcon data-icon="inline-start" />
              {vioPending ? "Generating…" : "Generate Vendor IO"}
            </Button>
          </form>
        ) : null}
        {reviseVioLineIds.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReviseOpen(true)}
          >
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

      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revise Vendor IO</DialogTitle>
            <DialogDescription>
              After invoice ungenerate, create a new VIO revision ({reviseVioLineIds.length}{" "}
              line{reviseVioLineIds.length === 1 ? "" : "s"}) with suffix /1, /2, etc. The
              previous revision is marked superseded.
            </DialogDescription>
          </DialogHeader>
          <form action={reviseAction} className="grid gap-3">
            <input type="hidden" name="campaign_id" value={campaignId} />
            <input type="hidden" name="line_ids" value={reviseVioLineIds.join(",")} />
            <div className="grid gap-2">
              <Label htmlFor="assignment_vio_revise_reason">Correction reason (required)</Label>
              <Textarea
                id="assignment_vio_revise_reason"
                name="reason"
                value={reviseReason}
                onChange={(e) => setReviseReason(e.target.value)}
                required
                rows={3}
                placeholder="Post-invoice correction: fee adjustment, scope change…"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReviseOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={revisePending || reviseReason.trim().length < 3}
              >
                {revisePending ? "Creating revision…" : "Create revision"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={ungenerateOpen} onOpenChange={setUngenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Un-generate Vendor IO</DialogTitle>
            <DialogDescription>
              Remove Vendor IO from {ungenerateIoLineIds.length} selected assignment
              {ungenerateIoLineIds.length === 1 ? "" : "s"} and return them to draft. Not
              allowed when a line is already invoiced.
            </DialogDescription>
          </DialogHeader>
          <form action={ungenerateAction} className="grid gap-3">
            <input type="hidden" name="campaign_id" value={campaignId} />
            <input type="hidden" name="line_ids" value={ungenerateIoLineIds.join(",")} />
            <div className="grid gap-2">
              <Label htmlFor="assignment_vio_ungenerate_reason">Reason (required)</Label>
              <Textarea
                id="assignment_vio_ungenerate_reason"
                name="reason"
                value={ungenerateReason}
                onChange={(e) => setUngenerateReason(e.target.value)}
                required
                rows={3}
                placeholder="Scope change, wrong batch, duplicate IO…"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUngenerateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={ungeneratePending || ungenerateReason.trim().length < 3}
              >
                {ungeneratePending ? "Un-generating…" : "Confirm un-generate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
