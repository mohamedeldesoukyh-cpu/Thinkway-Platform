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

export type ClientBillingInput = {
  revenueBeforeVat: number;
  usageRightsAmount?: number;
  agencyFeePercent?: number;
  vatPercent: number;
  vatExempt?: boolean;
  costBeforeVat?: number;
};

export type ClientBillingResult = {
  revenueBeforeVat: number;
  usageRightsAmount: number;
  agencyFeePercent: number;
  agencyFeeAmount: number;
  taxableBase: number;
  vatPercent: number;
  vatAmount: number;
  totalBilling: number;
  gp: number;
  marginPercent: number;
};

/** Client billing: VAT on (Revenue + UR + AF); GP = taxable base − cost. */
export function computeClientBilling(input: ClientBillingInput): ClientBillingResult {
  const revenueBeforeVat = roundMoney(Math.max(0, input.revenueBeforeVat));
  const usageRightsAmount = roundMoney(Math.max(0, input.usageRightsAmount ?? 0));
  const agencyFeePercent = Math.max(0, input.agencyFeePercent ?? 0);
  const agencyFeeAmount = computeAgencyFeeAmount(
    revenueBeforeVat,
    usageRightsAmount,
    agencyFeePercent
  );
  const taxableBase = roundMoney(revenueBeforeVat + usageRightsAmount + agencyFeeAmount);

  const vat = computeVatLine({
    beforeVat: taxableBase,
    vatPercent: input.vatExempt ? 0 : input.vatPercent,
    exempt: input.vatExempt,
  });

  const costBeforeVat = roundMoney(Math.max(0, input.costBeforeVat ?? 0));
  const gp = roundMoney(taxableBase - costBeforeVat);
  const marginPercent =
    taxableBase > 0 ? Math.round((gp / taxableBase) * 10000) / 100 : 0;

  return {
    revenueBeforeVat,
    usageRightsAmount,
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
