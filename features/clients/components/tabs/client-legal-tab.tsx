"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import { DETAIL_FORM_INPUT_CLASS } from "@/features/campaigns/components/operational-detail-panel";
import {
  ClientInlineDocumentAttach,
  findClientDocumentByType,
} from "@/features/clients/components/client-inline-document-attach";
import {
  updateClientLegalAction,
  type FormActionState,
} from "@/features/clients/actions";
import {
  COUNTRY_OPTIONS,
  getCityOptionsForCountry,
} from "@/features/clients/constants";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

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
  const [legalCity, setLegalCity] = useState(
    readAddress(legal, "city") || client.city || ""
  );

  const cityOptions = useMemo(() => {
    const options = getCityOptionsForCountry(legalCountry);
    if (legalCity && !options.some((option) => option.value === legalCity)) {
      return [{ value: legalCity, label: legalCity }, ...options];
    }
    return options;
  }, [legalCountry, legalCity]);

  const tradeLicenseDoc = findClientDocumentByType(client.documents, "trade_license");
  const vatDoc = findClientDocumentByType(client.documents, "vat_certificate");
  const taxDoc = findClientDocumentByType(client.documents, "tax_certificate");

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
    <OperationalFormSection
      title="Legal & compliance"
      description="Enter registration numbers and attach certificates using the controls beside each field."
      footer={
        <Button type="submit" form="client-legal-form" disabled={isPending}>
          {isPending ? "Saving…" : "Save legal"}
        </Button>
      }
    >
      <form id="client-legal-form" action={formAction} className="grid gap-4">
        <input type="hidden" name="client_id" value={client.id} />
        <input type="hidden" name="legal_address_country" value={legalCountry} />
        <input type="hidden" name="legal_address_city" value={legalCity} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="trade_license_number">Trade license / CR</Label>
            <div className="flex min-w-0 items-center gap-2">
              <ClientInlineDocumentAttach
                clientId={client.id}
                documentType="trade_license"
                document={tradeLicenseDoc}
              />
              <Input
                id="trade_license_number"
                name="trade_license_number"
                className={cn(DETAIL_FORM_INPUT_CLASS, "min-w-0 flex-1")}
                defaultValue={client.trade_license_number ?? ""}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="trade_license_expiry">Trade license expiry</Label>
            <Input
              id="trade_license_expiry"
              name="trade_license_expiry"
              type="date"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={client.trade_license_expiry ?? ""}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="vat_number">VAT number</Label>
            <div className="flex min-w-0 items-center gap-2">
              <ClientInlineDocumentAttach
                clientId={client.id}
                documentType="vat_certificate"
                document={vatDoc}
              />
              <Input
                id="vat_number"
                name="vat_number"
                className={cn(DETAIL_FORM_INPUT_CLASS, "min-w-0 flex-1")}
                defaultValue={client.vat_number ?? ""}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tax_id">Tax ID</Label>
            <div className="flex min-w-0 items-center gap-2">
              <ClientInlineDocumentAttach
                clientId={client.id}
                documentType="tax_certificate"
                document={taxDoc}
              />
              <Input
                id="tax_id"
                name="tax_id"
                className={cn(DETAIL_FORM_INPUT_CLASS, "min-w-0 flex-1")}
                defaultValue={client.tax_id ?? ""}
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="legal_address_line1">Legal address line 1</Label>
          <Input
            id="legal_address_line1"
            name="legal_address_line1"
            className={DETAIL_FORM_INPUT_CLASS}
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
            className={DETAIL_FORM_INPUT_CLASS}
            defaultValue={readAddress(legal, "line2")}
            disabled={isPending}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label>City</Label>
            <SearchableSelect
              value={legalCity}
              onValueChange={setLegalCity}
              options={cityOptions}
              disabled={isPending || !legalCountry}
              placeholder={legalCountry ? "Select city" : "Select country first"}
            />
          </div>
          <div className="grid gap-2">
            <Label>Country</Label>
            <SearchableSelect
              value={legalCountry}
              onValueChange={(value) => {
                setLegalCountry(value);
                setLegalCity("");
              }}
              options={COUNTRY_OPTIONS}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="legal_address_postal">Postal code</Label>
            <Input
              id="legal_address_postal"
              name="legal_address_postal"
              className={DETAIL_FORM_INPUT_CLASS}
              defaultValue={readAddress(legal, "postal_code")}
              disabled={isPending}
            />
          </div>
        </div>
      </form>
    </OperationalFormSection>
  );
}
