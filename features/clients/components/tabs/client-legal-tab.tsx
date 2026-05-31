"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateClientLegalAction,
  type FormActionState,
} from "@/features/clients/actions";
import { COUNTRY_OPTIONS } from "@/features/clients/constants";
import type { ClientDetail } from "@/types/database";

function readAddress(
  address: Record<string, unknown>,
  key: string
): string {
  const value = address[key];
  return typeof value === "string" ? value : "";
}

export function ClientLegalTab({ client }: { client: ClientDetail }) {
  const legal = client.legal_address ?? {};
  const [legalCountry, setLegalCountry] = useState(
    readAddress(legal, "country") || client.country || ""
  );

  const [state, formAction, isPending] = useActionState(
    updateClientLegalAction,
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
        <CardTitle>Legal & compliance</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="legal_address_country" value={legalCountry} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="trade_license_number">Trade license / CR</Label>
              <Input
                id="trade_license_number"
                name="trade_license_number"
                defaultValue={client.trade_license_number ?? ""}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trade_license_expiry">Trade license expiry</Label>
              <Input
                id="trade_license_expiry"
                name="trade_license_expiry"
                type="date"
                defaultValue={client.trade_license_expiry ?? ""}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="vat_number">VAT number</Label>
              <Input
                id="vat_number"
                name="vat_number"
                defaultValue={client.vat_number ?? ""}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tax_id">Tax ID</Label>
              <Input
                id="tax_id"
                name="tax_id"
                defaultValue={client.tax_id ?? ""}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="legal_address_line1">Legal address line 1</Label>
            <Input
              id="legal_address_line1"
              name="legal_address_line1"
              defaultValue={readAddress(legal, "line1")}
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.legal_address_line1} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="legal_address_line2">Legal address line 2</Label>
            <Input
              id="legal_address_line2"
              name="legal_address_line2"
              defaultValue={readAddress(legal, "line2")}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="legal_address_city">City</Label>
              <Input
                id="legal_address_city"
                name="legal_address_city"
                defaultValue={readAddress(legal, "city") || client.city || ""}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Country</Label>
              <SearchableSelect
                value={legalCountry}
                onValueChange={setLegalCountry}
                options={COUNTRY_OPTIONS}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="legal_address_postal">Postal code</Label>
              <Input
                id="legal_address_postal"
                name="legal_address_postal"
                defaultValue={readAddress(legal, "postal_code")}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save legal"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
