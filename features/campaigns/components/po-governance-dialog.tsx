"use client";

import { useActionState, useEffect } from "react";

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
import { formatMoney } from "@/features/campaigns/utils";
import {
  confirmPoOverrideAction,
  type FinanceActionState,
} from "@/features/finance/exchange-rates/actions";
import type { PoConsumptionSnapshot } from "@/lib/finance/po/calculations";

type PoGovernanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  lineId?: string;
  currency: string;
  snapshot: PoConsumptionSnapshot;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PoGovernanceDialog({
  open,
  onOpenChange,
  campaignId,
  lineId,
  currency,
  snapshot,
  onConfirm,
  onCancel,
}: PoGovernanceDialogProps) {
  const [state, formAction, pending] = useActionState(confirmPoOverrideAction, {
    ok: false,
  } satisfies FinanceActionState);

  useEffect(() => {
    if (state.ok) {
      onConfirm();
      onOpenChange(false);
    }
  }, [state.ok, onConfirm, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Campaign revenue exceeds approved client PO</DialogTitle>
          <DialogDescription>
            This assignment will exceed the approved PO budget. Confirm override or cancel to adjust revenue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-2xl border bg-muted/30 p-4 text-sm">
          <Row label="PO amount" value={formatMoney(snapshot.po_amount, currency)} />
          <Row label="Consumed" value={formatMoney(snapshot.consumed, currency)} />
          <Row
            label="Projected total"
            value={formatMoney(snapshot.projected_consumed, currency)}
          />
          <Row
            label="Exceeded by"
            value={formatMoney(snapshot.exceeded_amount, currency)}
          />
          <Row
            label="Projected remaining %"
            value={
              snapshot.projected_remaining_percent != null
                ? `${snapshot.projected_remaining_percent.toFixed(1)}%`
                : "—"
            }
          />
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="campaign_id" value={campaignId} />
          {lineId ? <input type="hidden" name="line_id" value={lineId} /> : null}
          <div className="grid gap-2">
            <Label htmlFor="override_reason">Override reason</Label>
            <Textarea
              id="override_reason"
              name="override_reason"
              rows={3}
              required
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Confirming…" : "Confirm override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
