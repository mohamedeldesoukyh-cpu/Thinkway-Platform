"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/features/campaigns/utils";
import type { ClientCreditLimitCheck } from "@/lib/finance/client-credit-exposure";

type CreditLimitExceededDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditLimit: ClientCreditLimitCheck;
  onAcceptRisk: () => void;
  onCancel: () => void;
  pending?: boolean;
};

export function CreditLimitExceededDialog({
  open,
  onOpenChange,
  creditLimit,
  onAcceptRisk,
  onCancel,
  pending = false,
}: CreditLimitExceededDialogProps) {
  const currency = creditLimit.currency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client exceeded credit limit</DialogTitle>
          <DialogDescription>
            This campaign would push the client beyond their approved credit limit.
            {creditLimit.can_accept_risk
              ? " You may accept the risk and continue with acknowledgment."
              : " Accept risk is not enabled for this client."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-2xl border bg-muted/30 p-4 text-sm">
          <Row
            label="Current exposure"
            value={formatMoney(creditLimit.exposure, currency)}
          />
          <Row
            label="Credit limit"
            value={
              creditLimit.limit != null
                ? formatMoney(creditLimit.limit, currency)
                : "—"
            }
          />
          <Row
            label="Projected exposure"
            value={formatMoney(creditLimit.projected_exposure, currency)}
          />
          <Row
            label="Exceeded by"
            value={formatMoney(creditLimit.exceeded_by, currency)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          {creditLimit.can_accept_risk ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onAcceptRisk}
              disabled={pending}
            >
              {pending ? "Creating…" : "Accept risk and continue"}
            </Button>
          ) : null}
        </DialogFooter>
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
