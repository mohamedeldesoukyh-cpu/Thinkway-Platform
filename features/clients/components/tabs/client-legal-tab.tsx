"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, ClipboardListIcon, MapPinIcon } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PLATFORM_V6_ICON_AMBER } from "@/components/platform/platform-v6-layout";
import { Input } from "@/components/ui/input";
import {
  ClientFormField,
  ClientFormGrid,
  ClientFormKeyboardShortcuts,
  ClientFormSection,
  ClientProfileTabShell,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/clients/components/client-form-ui";
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
import { assessClientLegalReadiness } from "@/lib/clients/legal-readiness";
import { assessClientTaxReadiness } from "@/lib/clients/tax-readiness";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

function readAddress(
  address: Record<string, unknown>,
  key: string
): string {
  const value = address[key];
  return typeof value === "string" ? value : "";
}

export function ClientLegalTab({
  client,
  onCancel,
  shortcutsEnabled = true,
}: {
  client: ClientDetail;
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
}) {
  const router = useRouter();
  const legal = client.legal_address ?? {};
  const [legalCountry, setLegalCountry] = useState(
    readAddress(legal, "country") || client.country || ""
  );
  const [legalCity, setLegalCity] = useState(
    readAddress(legal, "city") || client.city || ""
  );
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState(
    client.trade_license_number ?? ""
  );
  const [tradeLicenseExpiry, setTradeLicenseExpiry] = useState(
    client.trade_license_expiry ?? ""
  );
  const [vatNumber, setVatNumber] = useState(client.vat_number ?? "");
  const [taxId, setTaxId] = useState(client.tax_id ?? "");
  const [addressLine1, setAddressLine1] = useState(readAddress(legal, "line1"));
  const [addressLine2, setAddressLine2] = useState(readAddress(legal, "line2"));
  const [postalCode, setPostalCode] = useState(readAddress(legal, "postal_code"));
  const [isDirty, setIsDirty] = useState(false);

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

  const legalReadiness = useMemo(
    () =>
      assessClientLegalReadiness({
        trade_license_number: tradeLicenseNumber,
        trade_license_expiry: tradeLicenseExpiry,
        vat_number: vatNumber,
        legal_address: {
          line1: addressLine1,
          line2: addressLine2,
          city: legalCity,
          country: legalCountry,
          postal_code: postalCode,
        },
        documentTypes: client.documents.map((doc) => doc.document_type),
      }),
    [
      tradeLicenseNumber,
      tradeLicenseExpiry,
      vatNumber,
      addressLine1,
      addressLine2,
      legalCity,
      legalCountry,
      postalCode,
      client.documents,
    ]
  );

  const taxReadiness = useMemo(
    () =>
      assessClientTaxReadiness({
        tax_id: taxId,
        documentTypes: client.documents.map((doc) => doc.document_type),
      }),
    [taxId, client.documents]
  );

  const pendingItems = useMemo(() => {
    const items: string[] = [];
    if (!client.legal_completed_at) {
      items.push(...legalReadiness.missing);
    }
    if (!client.tax_completed_at) {
      items.push(...taxReadiness.missing);
    }
    return items;
  }, [
    client.legal_completed_at,
    client.tax_completed_at,
    legalReadiness.missing,
    taxReadiness.missing,
  ]);

  const showLegalPendingBanner =
    (client.onboarding_status === "legal_pending" && !client.legal_completed_at) ||
    (!client.tax_completed_at && pendingItems.length > 0);

  const [state, formAction, isPending] = useActionState(
    updateClientLegalAction,
    { ok: false } satisfies FormActionState
  );

  function markDirty() {
    setIsDirty(true);
  }

  function discardChanges() {
    setLegalCountry(readAddress(legal, "country") || client.country || "");
    setLegalCity(readAddress(legal, "city") || client.city || "");
    setTradeLicenseNumber(client.trade_license_number ?? "");
    setTradeLicenseExpiry(client.trade_license_expiry ?? "");
    setVatNumber(client.vat_number ?? "");
    setTaxId(client.tax_id ?? "");
    setAddressLine1(readAddress(legal, "line1"));
    setAddressLine2(readAddress(legal, "line2"));
    setPostalCode(readAddress(legal, "postal_code"));
    setIsDirty(false);
  }

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      setIsDirty(false);
      router.refresh();
      return;
    }
    toast.error(state.message);
  }, [state, router]);

  return (
    <>
      <ClientFormKeyboardShortcuts
        formId="client-legal-form"
        enabled={shortcutsEnabled}
        disabled={isPending}
      />
      <ClientProfileTabShell
        title="Legal & compliance"
        description="Registration numbers, certificates, and registered address for this legal entity."
        onCancel={onCancel}
        saveFormId="client-legal-form"
        saveLabel="Save legal"
        saveDisabled={isPending}
        isSaving={isPending}
        isDirty={isDirty}
        onDiscard={discardChanges}
        discardDisabled={isPending}
      >
        <form
          id="client-legal-form"
          action={formAction}
          className="grid gap-[18px]"
          onSubmit={(event) => {
            if (isPending) {
              event.preventDefault();
            }
          }}
        >
          {showLegalPendingBanner ? (
            <div
              className={cn(
                "rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground",
                pendingItems.length === 0 && "border-primary/30 bg-primary/10"
              )}
              role="status"
            >
              <div className="flex items-start gap-2">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium">
                    {pendingItems.length === 0
                      ? "All legal and tax requirements are met. Save legal to advance onboarding."
                      : "Complete the items below, then click Save legal."}
                  </p>
                  {pendingItems.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {pendingItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="legal_address_country" value={legalCountry} />
          <input type="hidden" name="legal_address_city" value={legalCity} />

          <ClientFormSection
            icon={ClipboardListIcon}
            title="Registration & certificates"
            description="Attach certificates using the controls beside each field."
          >
            <ClientFormGrid columns={4}>
              <ClientFormField label="Trade license / CR" htmlFor="trade_license_number">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <ClientInlineDocumentAttach
                    clientId={client.id}
                    documentType="trade_license"
                    document={tradeLicenseDoc}
                  />
                  <Input
                    id="trade_license_number"
                    name="trade_license_number"
                    className={cn(CLIENT_FORM_INPUT_CLASS, "min-w-0 flex-1")}
                    value={tradeLicenseNumber}
                    onChange={(e) => {
                      setTradeLicenseNumber(e.target.value);
                      markDirty();
                    }}
                    disabled={isPending}
                  />
                </div>
              </ClientFormField>
              <ClientFormField label="Trade license expiry" htmlFor="trade_license_expiry" hint="Required for legal approval">
                <Input
                  id="trade_license_expiry"
                  name="trade_license_expiry"
                  type="date"
                  required
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={tradeLicenseExpiry}
                  onChange={(e) => {
                    setTradeLicenseExpiry(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
              </ClientFormField>
              <ClientFormField label="VAT number" htmlFor="vat_number">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <ClientInlineDocumentAttach
                    clientId={client.id}
                    documentType="vat_certificate"
                    document={vatDoc}
                  />
                  <Input
                    id="vat_number"
                    name="vat_number"
                    className={cn(CLIENT_FORM_INPUT_CLASS, "min-w-0 flex-1")}
                    value={vatNumber}
                    onChange={(e) => {
                      setVatNumber(e.target.value);
                      markDirty();
                    }}
                    disabled={isPending}
                  />
                </div>
              </ClientFormField>
              <ClientFormField label="Tax ID" htmlFor="tax_id">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <ClientInlineDocumentAttach
                    clientId={client.id}
                    documentType="tax_certificate"
                    document={taxDoc}
                  />
                  <Input
                    id="tax_id"
                    name="tax_id"
                    className={cn(CLIENT_FORM_INPUT_CLASS, "min-w-0 flex-1")}
                    value={taxId}
                    onChange={(e) => {
                      setTaxId(e.target.value);
                      markDirty();
                    }}
                    disabled={isPending}
                  />
                </div>
              </ClientFormField>
            </ClientFormGrid>
          </ClientFormSection>

          <ClientFormSection
            icon={MapPinIcon}
            iconClassName={PLATFORM_V6_ICON_AMBER}
            title="Registered address"
            description="Legal address on file for compliance and invoicing."
          >
            <ClientFormGrid className="sm:grid-cols-2">
              <ClientFormField label="Legal address line 1" htmlFor="legal_address_line1">
                <Input
                  id="legal_address_line1"
                  name="legal_address_line1"
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={addressLine1}
                  onChange={(e) => {
                    setAddressLine1(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.legal_address_line1} />
              </ClientFormField>

              <ClientFormField label="Legal address line 2" htmlFor="legal_address_line2">
                <Input
                  id="legal_address_line2"
                  name="legal_address_line2"
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={addressLine2}
                  onChange={(e) => {
                    setAddressLine2(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
              </ClientFormField>
            </ClientFormGrid>

            <ClientFormGrid columns={4} className="mt-4">
              <ClientFormField label="Country">
                <SearchableSelect
                  value={legalCountry}
                  onValueChange={(value) => {
                    setLegalCountry(value);
                    setLegalCity("");
                    markDirty();
                  }}
                  options={COUNTRY_OPTIONS}
                  disabled={isPending}
                  className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
                />
              </ClientFormField>
              <ClientFormField label="City">
                <SearchableSelect
                  value={legalCity}
                  onValueChange={(value) => {
                    setLegalCity(value);
                    markDirty();
                  }}
                  options={cityOptions}
                  disabled={isPending || !legalCountry}
                  placeholder={legalCountry ? "Select city" : "Select country first"}
                  className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
                />
              </ClientFormField>
              <ClientFormField label="Postal code" htmlFor="legal_address_postal">
                <Input
                  id="legal_address_postal"
                  name="legal_address_postal"
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={postalCode}
                  onChange={(e) => {
                    setPostalCode(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
              </ClientFormField>
              <div className="hidden md:block" aria-hidden />
            </ClientFormGrid>
          </ClientFormSection>
        </form>
      </ClientProfileTabShell>
    </>
  );
}
