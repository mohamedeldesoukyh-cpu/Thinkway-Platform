"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

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
        <CardTitle>Finance</CardTitle>
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
