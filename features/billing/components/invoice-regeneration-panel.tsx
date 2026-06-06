"use client";

import { useActionState, useEffect, useState } from "react";
import { RefreshCwIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  regenerateInvoiceAction,
  ungenerateInvoiceAction,
  type BillingActionState,
} from "@/features/billing/actions";
import { InvoiceRegenerateCoveragePanel } from "@/features/billing/components/invoice-regenerate-coverage-panel";
import type { InvoiceWorkspace } from "@/features/billing/types";

type InvoiceRegenerationPanelProps = {
  invoice: InvoiceWorkspace;
};

export function InvoiceRegenerationPanel({ invoice }: InvoiceRegenerationPanelProps) {
  const [mode, setMode] = useState<"ungenerate" | "regenerate" | null>(null);
  const [reason, setReason] = useState("");

  const [ungenerateState, ungenerateAction, ungeneratePending] = useActionState(
    ungenerateInvoiceAction,
    { ok: false } satisfies BillingActionState
  );
  const [regenerateState, regenerateAction, regeneratePending] = useActionState(
    regenerateInvoiceAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    if (!ungenerateState.message) return;
    if (ungenerateState.ok) {
      toast.success(ungenerateState.message);
      setMode(null);
      setReason("");
    } else toast.error(ungenerateState.message);
  }, [ungenerateState]);

  useEffect(() => {
    if (!regenerateState.message) return;
    if (regenerateState.ok) {
      toast.success(regenerateState.message);
      setMode(null);
      setReason("");
    } else toast.error(regenerateState.message);
  }, [regenerateState]);

  const statusLabel =
    invoice.regeneration_status === "pending_regeneration"
      ? "Pending regeneration"
      : invoice.regeneration_status === "regenerated"
        ? `Regenerated (v${invoice.version_number})`
        : "Active";

  const coverage = invoice.regeneration_coverage ?? null;
  const regenerateBlocked = coverage?.case === "blocked";

  return (
    <>
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-base">Finance governance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Un-generate to unlock invoiced lines for corrections. Same invoice number is always preserved.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">{statusLabel}</Badge>
          {invoice.regeneration_status === "active" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMode("ungenerate")}
            >
              <Undo2Icon className="size-4" />
              Un-generate invoice
            </Button>
          ) : null}
          {invoice.regeneration_status === "pending_regeneration" ? (
            <Button size="sm" onClick={() => setMode("regenerate")}>
              <RefreshCwIcon className="size-4" />
              Regenerate invoice
            </Button>
          ) : null}
          {invoice.ungenerate_reason ? (
            <p className="w-full text-xs text-muted-foreground">
              Last un-generate reason: {invoice.ungenerate_reason}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={mode !== null} onOpenChange={() => setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "ungenerate" ? "Un-generate invoice" : "Regenerate invoice"}
            </DialogTitle>
            <DialogDescription>
              {mode === "ungenerate"
                ? `Unlock lines linked to ${formatDocumentNumberForDisplay(invoice.document_number)}. Invoice number ${formatDocumentNumberForDisplay(invoice.document_number)} remains reserved.`
                : `Refresh totals from corrected campaign lines. Invoice ${formatDocumentNumberForDisplay(invoice.document_number)} will be re-locked.`}
            </DialogDescription>
          </DialogHeader>
          <form
            action={mode === "ungenerate" ? ungenerateAction : regenerateAction}
            className="grid gap-3"
          >
            {mode === "regenerate" && coverage ? (
              <InvoiceRegenerateCoveragePanel coverage={coverage} />
            ) : null}
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <div className="grid gap-2">
              <Label htmlFor="gov_reason">Reason (required)</Label>
              <Textarea
                id="gov_reason"
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="Operational correction, pricing error, scope change…"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={mode === "ungenerate" ? "destructive" : "default"}
                disabled={
                  (mode === "ungenerate" ? ungeneratePending : regeneratePending) ||
                  !reason.trim() ||
                  (mode === "regenerate" && regenerateBlocked)
                }
              >
                {mode === "ungenerate"
                  ? ungeneratePending
                    ? "Un-generating…"
                    : "Confirm un-generate"
                  : regeneratePending
                    ? "Regenerating…"
                    : "Regenerate invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
