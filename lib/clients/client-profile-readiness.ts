import type { ClientProfileTabId } from "@/lib/workspace/platform-workspace-tabs";
import type { ClientDetail } from "@/types/database";

import { assessClientFinanceReadiness } from "./finance-readiness";
import { assessClientLegalReadiness } from "./legal-readiness";
import { assessClientTaxReadiness } from "./tax-readiness";

export type ProfileReadinessResult = {
  complete: boolean;
  missing: string[];
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** Commercial profile fields on overview — VR% is intentionally excluded. */
export function assessClientOverviewCommercialReadiness(
  client: Pick<
    ClientDetail,
    | "client_category"
    | "client_subcategory"
    | "agency_or_direct"
    | "country"
    | "city"
    | "billing_email"
  >
): ProfileReadinessResult {
  const missing: string[] = [];

  if (!hasText(client.client_category)) {
    missing.push("Category");
  }
  if (!hasText(client.client_subcategory)) {
    missing.push("Subcategory");
  }
  if (!hasText(client.agency_or_direct)) {
    missing.push("Relationship type");
  }
  if (!hasText(client.country)) {
    missing.push("Country");
  }
  if (!hasText(client.city)) {
    missing.push("City");
  }
  if (!hasText(client.billing_email)) {
    missing.push("Billing email");
  }

  return {
    complete: missing.length === 0,
    missing,
  };
}

export type ClientProfileTabMissingCounts = Partial<
  Record<ClientProfileTabId, number>
>;

/** Tab badges show incomplete/missing items only — never totals or VR%. */
export function computeClientProfileTabMissingCounts(
  client: ClientDetail
): ClientProfileTabMissingCounts {
  const counts: ClientProfileTabMissingCounts = {};

  const overviewReadiness = assessClientOverviewCommercialReadiness(client);
  if (overviewReadiness.missing.length > 0) {
    counts.overview = overviewReadiness.missing.length;
  }

  if (client.brands.length === 0) {
    counts.brands = 1;
  }

  const documentTypes = client.documents.map((doc) => doc.document_type);
  const legalReadiness = assessClientLegalReadiness({
    trade_license_number: client.trade_license_number,
    trade_license_expiry: client.trade_license_expiry,
    vat_number: client.vat_number,
    legal_address: client.legal_address,
    documentTypes,
  });
  let legalMissing = 0;
  if (!client.legal_completed_at && legalReadiness.missing.length > 0) {
    legalMissing += legalReadiness.missing.length;
  }
  const taxReadiness = assessClientTaxReadiness({
    tax_id: client.tax_id,
    documentTypes,
  });
  if (!client.tax_completed_at && taxReadiness.missing.length > 0) {
    legalMissing += taxReadiness.missing.length;
  }
  if (legalMissing > 0) {
    counts.legal = legalMissing;
  }

  const financeReadiness = assessClientFinanceReadiness({
    credit_limit_active: client.credit_limit_active ?? false,
    finance_completed_at: client.finance_completed_at,
  });
  if (financeReadiness.missing.length > 0) {
    counts.finance = financeReadiness.missing.length;
  }

  return counts;
}
