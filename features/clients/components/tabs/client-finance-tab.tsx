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
  updateClientFinanceAction,
  type FormActionState,
} from "@/features/clients/actions";
import {
  CURRENCY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
} from "@/features/clients/constants";
import type { ClientDetail } from "@/types/database";

export function ClientFinanceTab({ client }: { client: ClientDetail }) {
  const [currency, setCurrency] = useState(client.currency);
  const [paymentTerms, setPaymentTerms] = useState(client.payment_terms ?? "");

  const [state, formAction, isPending] = useActionState(
    updateClientFinanceAction,
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
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="payment_terms" value={paymentTerms} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={setCurrency}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Label htmlFor="credit_limit">Credit limit</Label>
              <Input
                id="credit_limit"
                name="credit_limit"
                type="number"
                min={0}
                step="0.01"
                defaultValue={
                  client.credit_limit != null ? String(client.credit_limit) : ""
                }
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.credit_limit} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="billing_email">Billing email</Label>
              <Input
                id="billing_email"
                name="billing_email"
                type="email"
                defaultValue={client.billing_email ?? ""}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="billing_phone">Billing phone</Label>
              <Input
                id="billing_phone"
                name="billing_phone"
                defaultValue={client.billing_phone ?? ""}
                disabled={isPending}
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
