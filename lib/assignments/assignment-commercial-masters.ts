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
};

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
