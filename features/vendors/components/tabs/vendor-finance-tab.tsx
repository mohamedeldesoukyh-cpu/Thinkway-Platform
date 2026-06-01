"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/forms/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  updateVendorFinanceAction,
  type FormActionState,
} from "@/features/vendors/actions";
import {
  PAYMENT_TERMS_OPTIONS,
  PRICING_CURRENCY_OPTIONS,
} from "@/features/vendors/constants";
import { parseRateCard } from "@/features/vendors/utils";
import type { VendorDetail } from "@/types/database";

export function VendorFinanceTab({ vendor }: { vendor: VendorDetail }) {
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
    <Card>
      <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Finance</CardTitle>
            {vatRegistered ? (
              <Badge variant="secondary">VAT Registered</Badge>
            ) : (
              <Badge variant="outline">Non-VAT</Badge>
            )}
          </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
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
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_CURRENCY_OPTIONS.map((o) => (
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
                defaultValue={
                  (vendor as { tax_registration_number?: string | null })
                    .tax_registration_number ?? ""
                }
                disabled={isPending || !vatRegistered}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save finance"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
