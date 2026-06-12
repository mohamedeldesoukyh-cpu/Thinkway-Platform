import { computeClientBilling } from "@/lib/assignments/client-billing-commercial";
import { computeVatLine } from "@/lib/vat/calculations";
import { resolveVendorDefaultVatPercent } from "@/lib/vat/queries";

export type LineVatFormInput = {
  revenue_before_vat: number;
  usage_rights_amount?: number;
  usage_rights_cost?: number;
  agency_fee_percent?: number;
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
  cost_before_vat: number;
  cost_vat_percent: number;
  cost_vat_exempt: boolean;
};

export function buildLineVatPayload(input: LineVatFormInput) {
  const billing = computeClientBilling({
    revenueBeforeVat: input.revenue_before_vat,
    usageRightsAmount: input.usage_rights_amount,
    usageRightsCost: input.usage_rights_cost,
    agencyFeePercent: input.agency_fee_percent,
    vatPercent: input.revenue_vat_percent,
    vatExempt: input.revenue_vat_exempt,
    costBeforeVat: input.cost_before_vat,
  });

  const cost = computeVatLine({
    beforeVat: input.cost_before_vat,
    vatPercent: input.cost_vat_percent,
    exempt: input.cost_vat_exempt,
  });

  return {
    revenue_before_vat: billing.revenueBeforeVat,
    usage_rights_amount: billing.usageRightsAmount,
    usage_rights_cost: billing.usageRightsCost,
    agency_fee_percent: billing.agencyFeePercent,
    agency_fee_amount: billing.agencyFeeAmount,
    revenue_vat_percent: billing.vatPercent,
    revenue_vat_amount: billing.vatAmount,
    revenue_after_vat: billing.totalBilling,
    revenue_vat_exempt: input.revenue_vat_exempt,
    revenue: billing.revenueBeforeVat,
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
