import { roundMoney } from "@/lib/vat/calculations";
import { computeVatLine } from "@/lib/vat/calculations";

export function computeAgencyFeeAmount(
  revenueBeforeVat: number,
  usageRightsAmount: number,
  agencyFeePercent: number
): number {
  const base = roundMoney(Math.max(0, revenueBeforeVat) + Math.max(0, usageRightsAmount));
  const percent = Math.max(0, agencyFeePercent);
  return roundMoney((base * percent) / 100);
}

/** Client VAT base: Revenue + UR Rev + agency fees (AF). */
export function resolveClientTaxableBase(input: {
  revenueBeforeVat: number;
  usageRightsAmount?: number;
  agencyFeeAmount?: number | null;
  agencyFeePercent?: number;
}): number {
  const revenueBeforeVat = roundMoney(Math.max(0, input.revenueBeforeVat));
  const usageRightsAmount = roundMoney(Math.max(0, input.usageRightsAmount ?? 0));
  const agencyFeeAmount =
    input.agencyFeeAmount != null && input.agencyFeeAmount > 0
      ? roundMoney(input.agencyFeeAmount)
      : computeAgencyFeeAmount(
          revenueBeforeVat,
          usageRightsAmount,
          input.agencyFeePercent ?? 0
        );
  return roundMoney(revenueBeforeVat + usageRightsAmount + agencyFeeAmount);
}

export type ClientBillingInput = {
  revenueBeforeVat: number;
  usageRightsAmount?: number;
  usageRightsCost?: number;
  agencyFeePercent?: number;
  vatPercent: number;
  vatExempt?: boolean;
  costBeforeVat?: number;
};

export type ClientBillingResult = {
  revenueBeforeVat: number;
  usageRightsAmount: number;
  usageRightsCost: number;
  agencyFeePercent: number;
  agencyFeeAmount: number;
  taxableBase: number;
  vatPercent: number;
  vatAmount: number;
  totalBilling: number;
  gp: number;
  marginPercent: number;
};

/** Client billing: VAT on (Revenue + UR Rev + Fees); GP = taxable base − cost − UR Cost. */
export function computeClientBilling(input: ClientBillingInput): ClientBillingResult {
  const revenueBeforeVat = roundMoney(Math.max(0, input.revenueBeforeVat));
  const usageRightsAmount = roundMoney(Math.max(0, input.usageRightsAmount ?? 0));
  const usageRightsCost = roundMoney(Math.max(0, input.usageRightsCost ?? 0));
  const agencyFeePercent = Math.max(0, input.agencyFeePercent ?? 0);
  const agencyFeeAmount = computeAgencyFeeAmount(
    revenueBeforeVat,
    usageRightsAmount,
    agencyFeePercent
  );
  const taxableBase = resolveClientTaxableBase({
    revenueBeforeVat,
    usageRightsAmount,
    agencyFeeAmount,
  });

  const vat = computeVatLine({
    beforeVat: taxableBase,
    vatPercent: input.vatExempt ? 0 : input.vatPercent,
    exempt: input.vatExempt,
  });

  const costBeforeVat = roundMoney(Math.max(0, input.costBeforeVat ?? 0));
  const gp = roundMoney(taxableBase - costBeforeVat - usageRightsCost);
  const marginPercent =
    taxableBase > 0 ? Math.round((gp / taxableBase) * 10000) / 100 : 0;

  return {
    revenueBeforeVat,
    usageRightsAmount,
    usageRightsCost,
    agencyFeePercent,
    agencyFeeAmount,
    taxableBase,
    vatPercent: vat.vatPercent,
    vatAmount: vat.vatAmount,
    totalBilling: vat.afterVat,
    gp,
    marginPercent,
  };
}
