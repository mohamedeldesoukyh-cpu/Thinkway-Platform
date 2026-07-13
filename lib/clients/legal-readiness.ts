export type ClientLegalReadinessInput = {
  trade_license_number: string | null | undefined;
  trade_license_expiry: string | null | undefined;
  vat_number: string | null | undefined;
  legal_address: Record<string, unknown> | null | undefined;
  documentTypes: readonly string[];
};

export type LegalReadinessResult = {
  complete: boolean;
  missing: string[];
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function readAddressField(
  address: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  const value = address?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasDocument(documentTypes: readonly string[], type: string): boolean {
  return documentTypes.includes(type);
}

/** Fields and certificates required before legal onboarding can advance. */
export function assessClientLegalReadiness(
  input: ClientLegalReadinessInput
): LegalReadinessResult {
  const missing: string[] = [];

  if (!hasText(input.trade_license_number)) {
    missing.push("Trade license / CR number");
  }
  if (!hasText(input.trade_license_expiry)) {
    missing.push("Trade license expiry date");
  }
  if (!hasDocument(input.documentTypes, "trade_license")) {
    missing.push("Trade license certificate");
  }
  if (!hasText(input.vat_number)) {
    missing.push("VAT number");
  }
  if (!hasDocument(input.documentTypes, "vat_certificate")) {
    missing.push("VAT certificate");
  }
  if (!readAddressField(input.legal_address, "line1")) {
    missing.push("Registered address line 1");
  }
  if (!readAddressField(input.legal_address, "country")) {
    missing.push("Registered address country");
  }
  if (!readAddressField(input.legal_address, "city")) {
    missing.push("Registered address city");
  }

  return {
    complete: missing.length === 0,
    missing,
  };
}
