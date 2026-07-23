"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCreatorAveragePriceAction } from "@/features/discovery/creator-profile/update-creator-commercial-actions";
import {
  DISCOVERY_DIALOG_BODY_CLASS,
  DISCOVERY_DIALOG_CONTENT_CLASS,
  DISCOVERY_DIALOG_DESC_CLASS,
  DISCOVERY_DIALOG_FOOTER_CLASS,
  DISCOVERY_DIALOG_HEADER_BAR_CLASS,
  DISCOVERY_DIALOG_HEADER_WRAP_CLASS,
  DISCOVERY_DIALOG_INPUT_CLASS,
  DISCOVERY_DIALOG_TITLE_CLASS,
} from "@/features/discovery/components/design-system";
import { parseRateCard } from "@/features/vendors/utils";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

const PRICE_CURRENCIES = ["EGP", "USD", "AED", "SAR", "EUR"] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: UnifiedCreatorResult;
  onSaved?: (creator: UnifiedCreatorResult) => void;
};

export function EditCreatorAveragePriceDialog({
  open,
  onOpenChange,
  creator,
  onSaved,
}: Props) {
  const influencerId = creator.influencer_id;
  const rate = parseRateCard(creator.rate_card);
  const [amount, setAmount] = useState(
    rate.base_rate != null ? String(rate.base_rate) : ""
  );
  const [currency, setCurrency] = useState(
    rate.currency ?? creator.suggested_currency ?? DEFAULT_PLATFORM_CURRENCY
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const next = parseRateCard(creator.rate_card);
    setAmount(next.base_rate != null ? String(next.base_rate) : "");
    setCurrency(next.currency ?? creator.suggested_currency ?? DEFAULT_PLATFORM_CURRENCY);
    setError(null);
  }, [open, creator.rate_card, creator.suggested_currency]);

  function handleSave() {
    if (!influencerId) {
      setError("This creator is not linked to a vendor profile yet.");
      return;
    }

    const trimmed = amount.trim();
    const parsedAmount = trimmed === "" ? undefined : Number(trimmed);
    if (trimmed !== "" && (parsedAmount == null || Number.isNaN(parsedAmount))) {
      setError("Enter a valid amount.");
      return;
    }

    startTransition(async () => {
      const result = await updateCreatorAveragePriceAction({
        influencerId,
        unifiedId: creator.unified_id,
        amount: parsedAmount,
        currency,
      });
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (result.creator) onSaved?.(result.creator);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DISCOVERY_DIALOG_CONTENT_CLASS, "sm:max-w-md")}>
        <div className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>
          <DialogHeader className={DISCOVERY_DIALOG_HEADER_BAR_CLASS}>
            <DialogTitle className={DISCOVERY_DIALOG_TITLE_CLASS}>
              Average price per content
            </DialogTitle>
            <DialogDescription className={DISCOVERY_DIALOG_DESC_CLASS}>
              Stored on the vendor rate card. Studio and assignment suggestions still prefer
              live quotation averages when available, then this rate.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className={cn(DISCOVERY_DIALOG_BODY_CLASS, "grid gap-3")}>
          <div className="grid gap-1.5">
            <Label htmlFor="creator-avg-price-amount">Average price</Label>
            <Input
              id="creator-avg-price-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={DISCOVERY_DIALOG_INPUT_CLASS}
              placeholder="0.00"
              disabled={isPending || !influencerId}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="creator-avg-price-currency">Currency</Label>
            <Select
              value={currency}
              onValueChange={setCurrency}
              disabled={isPending || !influencerId}
            >
              <SelectTrigger
                id="creator-avg-price-currency"
                className={cn(DISCOVERY_DIALOG_INPUT_CLASS, "w-full")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!influencerId ? (
            <p className="text-[12px] text-amber-700 dark:text-amber-300">
              Promote or link this creator to a vendor profile before editing pricing.
            </p>
          ) : null}
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className={DISCOVERY_DIALOG_FOOTER_CLASS}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || !influencerId}
          >
            {isPending ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save price"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
