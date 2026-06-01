import { computeVatLine } from "@/lib/vat/calculations";
import { resolveVendorDefaultVatPercent } from "@/lib/vat/queries";

export type LineVatFormInput = {
  revenue_before_vat: number;
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
  cost_before_vat: number;
  cost_vat_percent: number;
  cost_vat_exempt: boolean;
};

export function buildLineVatPayload(input: LineVatFormInput) {
  const revenue = computeVatLine({
    beforeVat: input.revenue_before_vat,
    vatPercent: input.revenue_vat_percent,
    exempt: input.revenue_vat_exempt,
  });

  const cost = computeVatLine({
    beforeVat: input.cost_before_vat,
    vatPercent: input.cost_vat_percent,
    exempt: input.cost_vat_exempt,
  });

  return {
    revenue_before_vat: revenue.beforeVat,
    revenue_vat_percent: revenue.vatPercent,
    revenue_vat_amount: revenue.vatAmount,
    revenue_after_vat: revenue.afterVat,
    revenue_vat_exempt: revenue.exempt,
    revenue: revenue.beforeVat,
    cost_before_vat: cost.beforeVat,
    cost_vat_percent: cost.vatPercent,
    cost_vat_amount: cost.vatAmount,
    cost_after_vat: cost.afterVat,
    cost_vat_exempt: cost.exempt,
    cost: cost.beforeVat,
  };
}

export function buildVendorCostVatPayload(input: {
  cost_before_vat: number;
  cost_vat_percent: number;
  cost_vat_exempt: boolean;
}) {
  const cost = computeVatLine({
    beforeVat: input.cost_before_vat,
    vatPercent: input.cost_vat_percent,
    exempt: input.cost_vat_exempt,
  });

  return {
    agreed_fee: cost.beforeVat,
    cost_before_vat: cost.beforeVat,
    cost_vat_percent: cost.vatPercent,
    cost_vat_amount: cost.vatAmount,
    cost_after_vat: cost.afterVat,
  };
}

export function defaultCostVatPercentForVendor(input: {
  vat_registered: boolean;
  default_vat_percent: number;
  country_code: string | null;
  country_vat_rate: number;
}) {
  return resolveVendorDefaultVatPercent({
    vatRegistered: input.vat_registered,
    defaultVatPercent: Number(input.default_vat_percent ?? 0),
    countryCode: input.country_code,
    countryVatRate: input.country_vat_rate,
  });
}
