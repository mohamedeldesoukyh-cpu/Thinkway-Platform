"use client";

import { FileStackIcon, FileTextIcon, GitBranchIcon, Undo2Icon } from "lucide-react";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
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
  OperationalFloatingActionBar,
  PLATFORM_FLOATING_BAR_PRIMARY_CLASS,
  PlatformFloatingBarDivider,
  PlatformFloatingBarPrimaryButton,
  PlatformFloatingBarSecondaryLink,
  PlatformFloatingBarSelection,
} from "@/components/workspace/operational-floating-action-bar";
import { cn } from "@/lib/utils";
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
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
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
      refreshAfterOperationalMutation();
    } else toast.error(vioState.message);
  }, [vioState, refreshAfterOperationalMutation]);

  useEffect(() => {
    if (!reviseState.message) return;
    if (reviseState.ok) {
      toast.success(reviseState.message);
      setReviseOpen(false);
      setReviseReason("");
      refreshAfterOperationalMutation();
    } else toast.error(reviseState.message);
  }, [reviseState, refreshAfterOperationalMutation]);

  useEffect(() => {
    if (!ungenerateState.message) return;
    if (ungenerateState.ok) {
      toast.success(ungenerateState.message);
      setUngenerateOpen(false);
      setUngenerateReason("");
      refreshAfterOperationalMutation();
    } else toast.error(ungenerateState.message);
  }, [ungenerateState, refreshAfterOperationalMutation]);

  const visible = selectedLineIds.length > 0;

  return (
    <>
      <OperationalFloatingActionBar visible={visible} className={className}>
        <PlatformFloatingBarSelection
          selectedCount={selectedLineIds.length}
          selectionLabel="line"
          onClearSelection={() => {}}
          showClearButton={false}
          busy={vioPending || revisePending || ungeneratePending}
        />

        {invoiceLineIds.length > 0 ? (
          <>
            <PlatformFloatingBarDivider />
            <span className="shrink-0 px-2 text-xs text-muted-foreground">
              Invoice {formatMoney(invoiceTotal, currency)}
            </span>
          </>
        ) : null}

        <PlatformFloatingBarDivider className="ml-auto" />

        <div className="flex shrink-0 items-center gap-1 pl-2">
          {vioLineIds.length > 0 ? (
            <form action={vioAction}>
              <input type="hidden" name="campaign_id" value={campaignId} />
              <input type="hidden" name="line_ids" value={vioLineIds.join(",")} />
              <Button
                type="submit"
                size="sm"
                className={cn(
                  "h-9 shrink-0 rounded-lg px-4 text-sm font-medium",
                  PLATFORM_FLOATING_BAR_PRIMARY_CLASS
                )}
                disabled={vioPending}
              >
                <FileStackIcon data-icon="inline-start" className="size-4" />
                {vioPending ? "Generating…" : "Generate Vendor IO"}
              </Button>
            </form>
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
          {invoiceLineIds.length > 0 ? (
            <PlatformFloatingBarPrimaryButton
              action={{
                id: "invoice",
                label: "Generate invoice",
                icon: FileTextIcon,
                onClick: () => onGenerateInvoice(invoiceLineIds),
              }}
            />
          ) : null}
        </div>
      </OperationalFloatingActionBar>

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
    </>
  );
}
