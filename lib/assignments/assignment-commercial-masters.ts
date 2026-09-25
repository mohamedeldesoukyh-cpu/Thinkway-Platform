import { computeAgencyFeeAmount } from "@/lib/assignments/client-billing-commercial";
import { roundMoney } from "@/lib/vat/calculations";

export type AssignmentCommercialSnapshot = {
  revenue_before_vat?: number | null;
  revenue?: number | null;
  cost_before_vat?: number | null;
  cost?: number | null;
  agency_fee_percent?: number | null;
  usage_rights_amount?: number | null;
  usage_rights_cost?: number | null;
  currency_code?: string | null;
  revenue_vat_percent?: number | null;
  revenue_vat_exempt?: boolean | null;
  cost_vat_percent?: number | null;
  cost_vat_exempt?: boolean | null;
};

/** Keep internal creator costs separate from the terms billed to the client. */
export function assignmentCommercialChangeScope(
  before: AssignmentCommercialSnapshot,
  after: AssignmentCommercialSnapshot
): { client: boolean; vendor: boolean } {
  const changed = (a: number | null | undefined, b: number | null | undefined) =>
    Math.abs(Number(a ?? 0) - Number(b ?? 0)) > 0.009;
  const currencyChanged = before.currency_code !== after.currency_code;
  return {
    client: currencyChanged ||
      changed(before.revenue_before_vat ?? before.revenue, after.revenue_before_vat ?? after.revenue) ||
      changed(before.usage_rights_amount, after.usage_rights_amount) ||
      changed(before.agency_fee_percent, after.agency_fee_percent) ||
      changed(before.revenue_vat_percent, after.revenue_vat_percent) ||
      Boolean(before.revenue_vat_exempt) !== Boolean(after.revenue_vat_exempt),
    vendor: currencyChanged ||
      changed(before.cost_before_vat ?? before.cost, after.cost_before_vat ?? after.cost) ||
      changed(before.usage_rights_cost, after.usage_rights_cost) ||
      changed(before.cost_vat_percent, after.cost_vat_percent) ||
      Boolean(before.cost_vat_exempt) !== Boolean(after.cost_vat_exempt),
  };
}

const MONEY_EPS = 0.009;
const PERCENT_EPS = 0.009;

function money(value: number | null | undefined): number {
  return Number(value ?? 0);
}

/** True when assignment commercial masters differ (Rev / Cost / AF% / UR). */
export function assignmentCommercialMastersChanged(
  existing: AssignmentCommercialSnapshot,
  next: AssignmentCommercialSnapshot
): boolean {
  return (
    Math.abs(money(next.revenue_before_vat ?? next.revenue) -
      money(existing.revenue_before_vat ?? existing.revenue)) > MONEY_EPS ||
    Math.abs(money(next.cost_before_vat ?? next.cost) -
      money(existing.cost_before_vat ?? existing.cost)) > MONEY_EPS ||
    Math.abs(money(next.agency_fee_percent) - money(existing.agency_fee_percent)) >
      PERCENT_EPS ||
    Math.abs(money(next.usage_rights_amount) - money(existing.usage_rights_amount)) >
      MONEY_EPS ||
    Math.abs(money(next.usage_rights_cost) - money(existing.usage_rights_cost)) >
      MONEY_EPS
  );
}

/** Recompute AF amount from % of (client revenue + UR Rev). */
export function recomputeAgencyFeeAmount(input: {
  revenueBeforeVat: number;
  usageRightsAmount?: number | null;
  agencyFeePercent?: number | null;
}): number {
  return computeAgencyFeeAmount(
    roundMoney(Math.max(0, input.revenueBeforeVat)),
    roundMoney(Math.max(0, Number(input.usageRightsAmount ?? 0))),
    Math.max(0, Number(input.agencyFeePercent ?? 0))
  );
}
