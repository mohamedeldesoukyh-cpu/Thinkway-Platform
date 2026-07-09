"use client";

import { useState } from "react";
import { DollarSignIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/forms/field-error";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormActionWithToast } from "@/hooks/use-form-action-with-toast";
import {
  updateVendorFinanceAction,
  type FormActionState,
} from "@/features/vendors/actions";
import { PAYMENT_TERMS_OPTIONS } from "@/features/vendors/constants";
import {
  VendorFormField,
  VendorFormGrid,
  VendorFormSection,
  VendorProfileTabShell,
  VENDOR_FORM_INPUT_CLASS,
  VENDOR_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/vendors/components/vendor-form-ui";
import { parseRateCard } from "@/features/vendors/utils";
import type { VendorDetail } from "@/types/database";
import { cn } from "@/lib/utils";
import { CreatorQuotationPriceReferencePanel } from "@/components/creator/creator-quotation-price-reference-panel";
import type { CreatorQuotationPriceReference } from "@/lib/creators/quotation-price-reference";

export function VendorFinanceTab({
  vendor,
  currencyOptions = [],
  sectionTitle = "Rate card & tax",
  hidePaymentTerms = false,
  embedded = false,
  quotationPriceReference = null,
  onCancel,
}: {
  vendor: VendorDetail;
  currencyOptions?: { value: string; label: string }[];
  sectionTitle?: string;
  /** Billing tab already edits payment terms via bank details. */
  hidePaymentTerms?: boolean;
  embedded?: boolean;
  quotationPriceReference?: CreatorQuotationPriceReference | null;
  onCancel?: () => void;
}) {
  const rate = parseRateCard(vendor.rate_card);
  const [paymentTerms, setPaymentTerms] = useState(vendor.payment_terms ?? "");
  const [currency, setCurrency] = useState(rate.currency ?? "USD");
  const [vatRegistered, setVatRegistered] = useState(
    (vendor as { vat_registered?: boolean }).vat_registered ?? false
  );

  const [state, formAction, isPending] = useFormActionWithToast(
    updateVendorFinanceAction,
    { ok: false } satisfies FormActionState
  );

  const form = (
    <form action={formAction} className="grid gap-[18px]">
      <input type="hidden" name="influencer_id" value={vendor.id} />
      <input type="hidden" name="payment_terms" value={paymentTerms} />
      <input type="hidden" name="pricing_currency" value={currency} />

      <VendorFormSection
        icon={DollarSignIcon}
        title={sectionTitle}
        description="Base rates, currency, and tax registration."
      >
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {vatRegistered ? (
            <Badge variant="secondary">VAT Registered</Badge>
          ) : (
            <Badge variant="outline">Non-VAT</Badge>
          )}
        </div>

        <VendorFormGrid className="lg:grid-cols-3">
          {hidePaymentTerms ? null : (
            <VendorFormField label="Payment terms">
              <Select
                value={paymentTerms}
                onValueChange={setPaymentTerms}
                disabled={isPending}
              >
                <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
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
            </VendorFormField>
          )}
          <VendorFormField label="Rate card currency">
            <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
              <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
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
          </VendorFormField>
          <VendorFormField label="Base rate" htmlFor="pricing_amount">
            <Input
              id="pricing_amount"
              name="pricing_amount"
              type="number"
              min={0}
              step="0.01"
              className={VENDOR_FORM_INPUT_CLASS}
              defaultValue={rate.base_rate != null ? String(rate.base_rate) : ""}
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.pricing_amount} />
          </VendorFormField>
        </VendorFormGrid>

        <VendorFormGrid className="lg:grid-cols-3">
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
          <input type="hidden" name="vat_registered" value={vatRegistered ? "1" : "0"} />
          <VendorFormField label="Default VAT %" htmlFor="default_vat_percent">
            <Input
              id="default_vat_percent"
              name="default_vat_percent"
              type="number"
              min={0}
              max={100}
              step="0.001"
              className={VENDOR_FORM_INPUT_CLASS}
              defaultValue={String(
                (vendor as { default_vat_percent?: number }).default_vat_percent ?? 0
              )}
              disabled={isPending || !vatRegistered}
            />
          </VendorFormField>
          <VendorFormField
            label="Tax registration number"
            htmlFor="tax_registration_number"
            className="sm:col-span-2"
          >
            <Input
              id="tax_registration_number"
              name="tax_registration_number"
              className={VENDOR_FORM_INPUT_CLASS}
              defaultValue={
                (vendor as { tax_registration_number?: string | null })
                  .tax_registration_number ?? ""
              }
              disabled={isPending || !vatRegistered}
            />
          </VendorFormField>
        </VendorFormGrid>

        {!embedded ? (
          <div className="flex justify-end border-t border-border pt-4">
            <button
              type="submit"
              className="inline-flex h-auto items-center rounded-[10px] border-transparent bg-[linear-gradient(135deg,#0057FF_0%,#2E74FF_55%,#1A6FFF_100%)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,87,255,0.3)] disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save rate card"}
            </button>
          </div>
        ) : null}
      </VendorFormSection>

      <VendorFormSection
        icon={DollarSignIcon}
        title="Quotation price reference"
        description="Average creator cost from quotation lines — used in studio and influencer selection."
      >
        <CreatorQuotationPriceReferencePanel reference={quotationPriceReference} />
      </VendorFormSection>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <VendorProfileTabShell
      title="Finance"
      description="Rate card, currency, and tax registration for this creator."
      onCancel={onCancel}
    >
      {form}
    </VendorProfileTabShell>
  );
}
