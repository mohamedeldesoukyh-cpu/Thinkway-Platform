/**
 * Payment Readiness — separate from Profile Completeness.
 * Only mandatory payment/bank fields block Finance payments.
 * Legal / client document gaps are warnings only.
 */

export const BANK_RELATIONSHIP_OPTIONS = [
  { value: "account_owner", label: "Account Owner" },
  { value: "parent", label: "Parent" },
  { value: "spouse", label: "Spouse" },
  { value: "agency", label: "Agency" },
  { value: "management_company", label: "Management Company" },
  { value: "business_partner", label: "Business Partner" },
  { value: "other", label: "Other" },
] as const;

export type BankRelationshipType =
  (typeof BANK_RELATIONSHIP_OPTIONS)[number]["value"];

export type PaymentReadinessFieldCode =
  | "beneficiary_name"
  | "relationship_type"
  | "relationship_description"
  | "bank_name"
  | "currency"
  | "swift"
  | "iban_or_account_number";

export type PaymentReadinessMissingItem = {
  code: PaymentReadinessFieldCode;
  label: string;
};

export type PaymentWarningItem = {
  code: string;
  label: string;
};

export type PaymentBankAccountSignals = {
  beneficiary_name?: string | null;
  account_holder?: string | null;
  relationship_type?: string | null;
  relationship_description?: string | null;
  bank_name?: string | null;
  currency?: string | null;
  swift?: string | null;
  iban?: string | null;
  account_number?: string | null;
  is_default?: boolean;
  is_verified?: boolean;
};

export type PaymentReadinessResult = {
  ready: boolean;
  missing: PaymentReadinessMissingItem[];
  warnings: PaymentWarningItem[];
  bankAccountId: string | null;
};

function present(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function resolvePaymentBankAccount(
  accounts: Array<PaymentBankAccountSignals & { id?: string }>,
  legacyPaymentDetails?: Record<string, unknown> | null
): (PaymentBankAccountSignals & { id?: string }) | null {
  if (accounts.length > 0) {
    const verifiedDefault = accounts.find((a) => a.is_default && a.is_verified);
    if (verifiedDefault) return verifiedDefault;
    const defaultAccount = accounts.find((a) => a.is_default);
    if (defaultAccount) return defaultAccount;
    return accounts[0] ?? null;
  }

  if (!legacyPaymentDetails) return null;
  return {
    beneficiary_name:
      (legacyPaymentDetails.beneficiary_name as string | undefined) ??
      (legacyPaymentDetails.account_holder as string | undefined) ??
      null,
    account_holder:
      (legacyPaymentDetails.account_holder as string | undefined) ?? null,
    relationship_type:
      (legacyPaymentDetails.relationship_type as string | undefined) ?? null,
    relationship_description:
      (legacyPaymentDetails.relationship_description as string | undefined) ??
      null,
    bank_name: (legacyPaymentDetails.bank_name as string | undefined) ?? null,
    currency: (legacyPaymentDetails.currency as string | undefined) ?? null,
    swift:
      (legacyPaymentDetails.swift as string | undefined) ??
      (legacyPaymentDetails.SWIFT as string | undefined) ??
      null,
    iban:
      (legacyPaymentDetails.iban as string | undefined) ??
      (legacyPaymentDetails.IBAN as string | undefined) ??
      null,
    account_number:
      (legacyPaymentDetails.account_number as string | undefined) ?? null,
    is_default: true,
    is_verified: false,
  };
}

export function computePaymentReadiness(input: {
  bank: PaymentBankAccountSignals | null;
  documentTypes?: string[];
}): PaymentReadinessResult {
  const missing: PaymentReadinessMissingItem[] = [];
  const bank = input.bank;

  if (!bank) {
    return {
      ready: false,
      missing: [
        { code: "beneficiary_name", label: "Beneficiary Name" },
        { code: "relationship_type", label: "Relationship Type" },
        { code: "bank_name", label: "Bank Name" },
        { code: "currency", label: "Currency" },
        { code: "swift", label: "SWIFT Code" },
        { code: "iban_or_account_number", label: "IBAN or Account Number" },
      ],
      warnings: buildLegalWarnings(input.documentTypes ?? []),
      bankAccountId: null,
    };
  }

  const beneficiary =
    bank.beneficiary_name?.trim() || bank.account_holder?.trim() || "";
  if (!present(beneficiary)) {
    missing.push({ code: "beneficiary_name", label: "Beneficiary Name" });
  }

  if (!present(bank.relationship_type)) {
    missing.push({ code: "relationship_type", label: "Relationship Type" });
  } else if (
    bank.relationship_type === "other" &&
    !present(bank.relationship_description)
  ) {
    missing.push({
      code: "relationship_description",
      label: "Relationship Description",
    });
  }

  if (!present(bank.bank_name)) {
    missing.push({ code: "bank_name", label: "Bank Name" });
  }
  if (!present(bank.currency)) {
    missing.push({ code: "currency", label: "Currency" });
  }
  if (!present(bank.swift)) {
    missing.push({ code: "swift", label: "SWIFT Code" });
  }

  const hasIban = present(bank.iban);
  const hasAccount = present(bank.account_number);
  if (!hasIban && !hasAccount) {
    missing.push({
      code: "iban_or_account_number",
      label: "IBAN or Account Number",
    });
  }

  return {
    ready: missing.length === 0,
    missing,
    warnings: buildLegalWarnings(input.documentTypes ?? []),
    bankAccountId: (bank as { id?: string }).id ?? null,
  };
}

function buildLegalWarnings(documentTypes: string[]): PaymentWarningItem[] {
  const docs = new Set(documentTypes.map((d) => d.toLowerCase()));
  const checks: Array<{ code: string; label: string; types: string[] }> = [
    { code: "passport", label: "Missing passport", types: ["passport"] },
    {
      code: "vat",
      label: "Missing VAT certificate",
      types: ["vat_certificate", "vat"],
    },
    {
      code: "trade_licence",
      label: "Missing trade licence",
      types: ["trade_licence", "trade_license"],
    },
    {
      code: "media_licence",
      label: "Missing media licence",
      types: ["media_licence", "media_license"],
    },
    { code: "nda", label: "Missing NDA", types: ["nda"] },
    {
      code: "tax",
      label: "Missing tax certificate",
      types: ["tax_document", "tax_certificate"],
    },
  ];

  return checks
    .filter((c) => !c.types.some((t) => docs.has(t)))
    .map((c) => ({ code: c.code, label: c.label }));
}
