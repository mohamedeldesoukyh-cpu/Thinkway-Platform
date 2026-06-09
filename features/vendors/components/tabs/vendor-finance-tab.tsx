"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/forms/field-error";
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
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import {
  updateVendorFinanceAction,
  type FormActionState,
} from "@/features/vendors/actions";
import {
  PAYMENT_TERMS_OPTIONS,
} from "@/features/vendors/constants";
import { parseRateCard } from "@/features/vendors/utils";
import type { VendorDetail } from "@/types/database";
import { cn } from "@/lib/utils";

export function VendorFinanceTab({
  vendor,
  currencyOptions = [],
}: {
  vendor: VendorDetail;
  currencyOptions?: { value: string; label: string }[];
}) {
  const rate = parseRateCard(vendor.rate_card);
  const [paymentTerms, setPaymentTerms] = useState(vendor.payment_terms ?? "");
  const [currency, setCurrency] = useState(rate.currency ?? "USD");
  const [vatRegistered, setVatRegistered] = useState(
    (vendor as { vat_registered?: boolean }).vat_registered ?? false
  );

  const [state, formAction, isPending] = useActionState(
    updateVendorFinanceAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  return (
    <OperationalFormSection
      title="Finance"
      actions={
        vatRegistered ? (
          <Badge variant="secondary">VAT Registered</Badge>
        ) : (
          <Badge variant="outline">Non-VAT</Badge>
        )
      }
      footer={
        <Button type="submit" form="vendor-finance-form" disabled={isPending}>
          {isPending ? "Saving…" : "Save finance"}
        </Button>
      }
    >
      <form id="vendor-finance-form" action={formAction} className="grid gap-4">
        <input type="hidden" name="influencer_id" value={vendor.id} />
        <input type="hidden" name="payment_terms" value={paymentTerms} />
        <input type="hidden" name="pricing_currency" value={currency} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-2">
            <Label>Payment terms</Label>
            <Select
              value={paymentTerms}
              onValueChange={setPaymentTerms}
              disabled={isPending}
            >
              <SelectTrigger className={cn(DETAIL_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                <SelectValue placeholder="Select terms" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Rate card currency</Label>
            <Select
              value={currency}
              onValueChange={setCurrency}
              disabled={isPending}
            >
              <SelectTrigger className={cn(DETAIL_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pricing_amount">Base rate</Label>
            <Input
              id="pricing_amount"
              name="pricing_amount"
              type="number"
              min={0}
              step="0.01"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={
                rate.base_rate != null ? String(rate.base_rate) : ""
              }
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.pricing_amount} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input
              type="checkbox"
              checked={vatRegistered}
              onChange={(e) => setVatRegistered(e.target.checked)}
              disabled={isPending}
              className="size-4 rounded border border-input"
            />
            VAT registered vendor
          </label>
          <input
            type="hidden"
            name="vat_registered"
            value={vatRegistered ? "1" : "0"}
          />
          <div className="grid gap-2">
            <Label htmlFor="default_vat_percent">Default VAT %</Label>
            <Input
              id="default_vat_percent"
              name="default_vat_percent"
              type="number"
              min={0}
              max={100}
              step="0.001"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={String(
                (vendor as { default_vat_percent?: number }).default_vat_percent ?? 0
              )}
              disabled={isPending || !vatRegistered}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="tax_registration_number">Tax registration number</Label>
            <Input
              id="tax_registration_number"
              name="tax_registration_number"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={
                (vendor as { tax_registration_number?: string | null })
                  .tax_registration_number ?? ""
              }
              disabled={isPending || !vatRegistered}
            />
          </div>
        </div>
      </form>
    </OperationalFormSection>
  );
}
