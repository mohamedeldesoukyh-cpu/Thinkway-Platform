export type TaxReadinessInput = {
  tax_id: string | null | undefined;
  documentTypes: readonly string[];
};

export type TaxReadinessResult = {
  complete: boolean;
  missing: string[];
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasDocument(documentTypes: readonly string[], type: string): boolean {
  return documentTypes.includes(type);
}

/** Tax ID and certificate required before tax onboarding can advance. */
export function assessClientTaxReadiness(input: TaxReadinessInput): TaxReadinessResult {
  const missing: string[] = [];

  if (!hasText(input.tax_id)) {
    missing.push("Tax ID");
  }
  if (!hasDocument(input.documentTypes, "tax_certificate")) {
    missing.push("Tax certificate");
  }

  return {
    complete: missing.length === 0,
    missing,
  };
}
