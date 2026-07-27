/**
 * Commercial CRM completeness — reuses influencer + document + bank signals.
 * Writes scores into creator_crm_profiles when writers/path updates run.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type CompletenessDimension =
  | "identity"
  | "commercial"
  | "legal"
  | "finance"
  | "client_compliance";

export type CompletenessMissingItem = {
  code: string;
  label: string;
  dimension: CompletenessDimension;
};

export type CompletenessBreakdown = {
  overall: number;
  dimensions: Record<CompletenessDimension, number>;
  missing: CompletenessMissingItem[];
};

type InfluencerSignals = {
  display_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  legal_name: string | null;
  rate_card: Record<string, unknown> | null;
  payment_details: Record<string, unknown> | null;
  payment_terms: string | null;
  vat_registered: boolean | null;
  tax_registration_number: string | null;
  contract_status: string | null;
  preferred_currency?: string | null;
};

function scoreDimension(
  present: number,
  total: number
): number {
  if (total <= 0) return 100;
  return Math.round((present / total) * 100);
}

function hasRate(rateCard: Record<string, unknown> | null): boolean {
  if (!rateCard) return false;
  const base = rateCard.base_rate ?? rateCard.amount;
  return base != null && String(base).trim() !== "";
}

function hasBank(details: Record<string, unknown> | null): boolean {
  if (!details) return false;
  const iban = details.iban ?? details.IBAN;
  const account = details.account_number ?? details.accountNumber;
  const bank = details.bank_name ?? details.bankName;
  return Boolean(
    (typeof iban === "string" && iban.trim()) ||
      (typeof account === "string" && account.trim()) ||
      (typeof bank === "string" && bank.trim())
  );
}

export function computeCompletenessBreakdown(input: {
  influencer: InfluencerSignals;
  platformCount: number;
  documentTypes: string[];
  bankAccountCount?: number;
  verifiedDefaultBank?: boolean;
  clientRequiredDocTypes?: string[];
}): CompletenessBreakdown {
  const missing: CompletenessMissingItem[] = [];
  const docs = new Set(input.documentTypes);

  // Identity
  const identityChecks: Array<[boolean, CompletenessMissingItem]> = [
    [
      Boolean(input.influencer.display_name?.trim()),
      { code: "display_name", label: "Display name", dimension: "identity" },
    ],
    [
      Boolean(input.influencer.email?.trim() || input.influencer.phone?.trim()),
      { code: "contact", label: "Email or phone", dimension: "identity" },
    ],
    [
      Boolean(input.influencer.country_code?.trim()),
      { code: "country", label: "Country", dimension: "identity" },
    ],
    [
      input.platformCount > 0,
      { code: "platform", label: "Platform account", dimension: "identity" },
    ],
  ];
  let identityPresent = 0;
  for (const [ok, item] of identityChecks) {
    if (ok) identityPresent += 1;
    else missing.push(item);
  }

  // Commercial
  const commercialChecks: Array<[boolean, CompletenessMissingItem]> = [
    [
      hasRate(input.influencer.rate_card),
      { code: "rates", label: "Rates", dimension: "commercial" },
    ],
    [
      Boolean(input.influencer.payment_terms?.trim()),
      {
        code: "payment_terms",
        label: "Payment terms",
        dimension: "commercial",
      },
    ],
  ];
  let commercialPresent = 0;
  for (const [ok, item] of commercialChecks) {
    if (ok) commercialPresent += 1;
    else missing.push(item);
  }

  // Legal
  const legalDocNeeded = [
    ["passport", "Passport"],
    ["national_id", "National ID"],
    ["signed_contract", "Contract"],
    ["tax_document", "Tax certificate"],
  ] as const;
  let legalPresent = 0;
  for (const [type, label] of legalDocNeeded) {
    if (docs.has(type)) legalPresent += 1;
    else
      missing.push({
        code: type,
        label,
        dimension: "legal",
      });
  }
  if (
    input.influencer.vat_registered &&
    !input.influencer.tax_registration_number?.trim()
  ) {
    missing.push({
      code: "vat_number",
      label: "VAT / tax number",
      dimension: "legal",
    });
  } else if (input.influencer.vat_registered) {
    legalPresent += 1;
  }

  // Finance
  const bankOk =
    (input.bankAccountCount ?? 0) > 0 ||
    hasBank(input.influencer.payment_details);
  const verifiedOk =
    input.verifiedDefaultBank === undefined
      ? bankOk
      : Boolean(input.verifiedDefaultBank);
  const financeChecks: Array<[boolean, CompletenessMissingItem]> = [
    [
      bankOk,
      { code: "bank", label: "Bank account", dimension: "finance" },
    ],
    [
      verifiedOk,
      {
        code: "bank_verified",
        label: "Verified default bank",
        dimension: "finance",
      },
    ],
    [
      docs.has("bank_letter") || bankOk,
      {
        code: "bank_letter",
        label: "Bank letter",
        dimension: "finance",
      },
    ],
  ];
  let financePresent = 0;
  for (const [ok, item] of financeChecks) {
    if (ok) financePresent += 1;
    else missing.push(item);
  }

  // Client compliance (optional required docs)
  const required = input.clientRequiredDocTypes ?? [];
  let compliancePresent = 0;
  let complianceTotal = required.length;
  if (complianceTotal === 0) {
    complianceTotal = 1;
    compliancePresent = 1;
  } else {
    for (const type of required) {
      if (docs.has(type)) compliancePresent += 1;
      else
        missing.push({
          code: `client_${type}`,
          label: `Client requires ${type.replace(/_/g, " ")}`,
          dimension: "client_compliance",
        });
    }
  }

  const dimensions: Record<CompletenessDimension, number> = {
    identity: scoreDimension(identityPresent, identityChecks.length),
    commercial: scoreDimension(commercialPresent, commercialChecks.length),
    legal: scoreDimension(
      legalPresent,
      legalDocNeeded.length + (input.influencer.vat_registered ? 1 : 0)
    ),
    finance: scoreDimension(financePresent, financeChecks.length),
    client_compliance: scoreDimension(compliancePresent, complianceTotal),
  };

  const weights: Record<CompletenessDimension, number> = {
    identity: 0.25,
    commercial: 0.2,
    legal: 0.25,
    finance: 0.2,
    client_compliance: 0.1,
  };
  const overall = Math.round(
    (Object.keys(dimensions) as CompletenessDimension[]).reduce(
      (sum, key) => sum + dimensions[key] * weights[key],
      0
    )
  );

  return { overall, dimensions, missing };
}

export async function refreshCommercialCreatorCompleteness(
  supabase: Supabase,
  influencerId: string,
  clientRequiredDocTypes: string[] = []
): Promise<CompletenessBreakdown | null> {
  const [{ data: influencer }, { data: platforms }, { data: documents }] =
    await Promise.all([
      supabase
        .from("influencers")
        .select(
          "display_name, email, phone, country_code, legal_name, rate_card, payment_details, payment_terms, vat_registered, tax_registration_number, contract_status"
        )
        .eq("id", influencerId)
        .maybeSingle(),
      supabase
        .from("influencer_platform_accounts")
        .select("id")
        .eq("influencer_id", influencerId),
      supabase
        .from("influencer_documents")
        .select("document_type")
        .eq("influencer_id", influencerId),
    ]);

  if (!influencer) return null;

  let bankRows: Array<{
    id: string;
    is_default: boolean;
    is_verified: boolean;
  }> = [];
  try {
    const { data: banks, error: bankError } = await supabase
      .from("influencer_bank_accounts" as never)
      .select("id, is_default, is_verified")
      .eq("influencer_id", influencerId);
    if (!bankError && banks) {
      bankRows = banks as typeof bankRows;
    }
  } catch {
    bankRows = [];
  }

  const breakdown = computeCompletenessBreakdown({
    influencer: influencer as InfluencerSignals,
    platformCount: platforms?.length ?? 0,
    documentTypes: (documents ?? []).map((d) => d.document_type),
    bankAccountCount: bankRows.length,
    verifiedDefaultBank: bankRows.some((b) => b.is_default && b.is_verified),
    clientRequiredDocTypes,
  });

  await supabase
    .from("creator_crm_profiles")
    .update({
      completeness_score: breakdown.overall,
      completeness_missing: breakdown.missing,
      completeness_updated_at: new Date().toISOString(),
    } as never)
    .eq("influencer_id", influencerId);

  return breakdown;
}
