import {
  rollupLineClientCommercial,
  type LineCommercialRollupInput,
} from "@/lib/assignments/client-billing-commercial";

export type LinePoCommercialInput = {
  revenue_before_vat?: number | null;
  revenue?: number | null;
  usage_rights_amount?: number | null;
  agency_fee_percent?: number | null;
  agency_fee_amount?: number | null;
};

/** Client PO consumption per line: Revenue + UR Rev + AF (ex-VAT). */
export function resolveLinePoBillableBase(
  line: LinePoCommercialInput
): number {
  return rollupLineClientCommercial(lineCommercialInput(line)).billableBase;
}

export function lineCommercialInput(
  line: LinePoCommercialInput
): LineCommercialRollupInput {
  return {
    revenueBeforeVat: Number(line.revenue_before_vat ?? line.revenue ?? 0),
    usageRightsAmount: Number(line.usage_rights_amount ?? 0),
    agencyFeePercent: Number(line.agency_fee_percent ?? 0),
    agencyFeeAmount: line.agency_fee_amount,
  };
}
