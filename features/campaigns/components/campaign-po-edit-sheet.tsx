"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { CampaignPoSummary } from "@/features/campaigns/types";
import {
  updateCampaignPoAction,
  type FinanceActionState,
} from "@/features/finance/exchange-rates/actions";

type CampaignPoEditSheetProps = {
  campaignId: string;
  campaignCurrency: string;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CampaignPoEditSheet({
  campaignId,
  campaignCurrency,
  po,
  currencyOptions,
  open,
  onOpenChange,
}: CampaignPoEditSheetProps) {
  const [state, formAction, pending] = useActionState(updateCampaignPoAction, {
    ok: false,
  } satisfies FinanceActionState);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit campaign PO</SheetTitle>
          <SheetDescription>
            Updates create PO governance logs. FX snapshot is preserved on save.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="campaign_id" value={campaignId} />
          <div className="grid gap-2">
            <Label htmlFor="po_number">PO number</Label>
            <Input
              id="po_number"
              name="po_number"
              defaultValue={po.po_number ?? ""}
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="po_currency">PO currency</Label>
            <Select name="po_currency" defaultValue={po.po_currency ?? campaignCurrency}>
              <SelectTrigger id="po_currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="po_amount_original">PO amount (original currency)</Label>
            <Input
              id="po_amount_original"
              name="po_amount_original"
              type="number"
              min={0}
              step="0.01"
              defaultValue={po.po_amount_original}
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="po_exchange_rate">
              FX rate (to {campaignCurrency})
            </Label>
            <Input
              id="po_exchange_rate"
              name="po_exchange_rate"
              type="number"
              min={0}
              step="0.000001"
              defaultValue={po.po_exchange_rate ?? 1}
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="po_expiry_date">PO expiry</Label>
            <Input
              id="po_expiry_date"
              name="po_expiry_date"
              type="date"
              defaultValue={po.po_expiry_date ?? ""}
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="override_reason">Change reason (optional)</Label>
            <Textarea
              id="override_reason"
              name="override_reason"
              rows={3}
              disabled={pending}
            />
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save PO"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
