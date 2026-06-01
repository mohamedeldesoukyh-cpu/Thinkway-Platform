export type VatLineInput = {
  beforeVat: number;
  vatPercent: number;
  exempt?: boolean;
};

export type VatLineResult = {
  beforeVat: number;
  vatPercent: number;
  vatAmount: number;
  afterVat: number;
  exempt: boolean;
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeVatLine(input: VatLineInput): VatLineResult {
  const beforeVat = roundMoney(Math.max(0, input.beforeVat));
  const exempt = Boolean(input.exempt);

  if (exempt || input.vatPercent <= 0) {
    return {
      beforeVat,
      vatPercent: exempt ? 0 : Math.max(0, input.vatPercent),
      vatAmount: 0,
      afterVat: beforeVat,
      exempt,
    };
  }

  const vatPercent = Math.max(0, input.vatPercent);
  const vatAmount = roundMoney((beforeVat * vatPercent) / 100);

  return {
    beforeVat,
    vatPercent,
    vatAmount,
    afterVat: roundMoney(beforeVat + vatAmount),
    exempt: false,
  };
}

export function computeOperationalGp(revenueBeforeVat: number, costBeforeVat: number) {
  const revenue = roundMoney(revenueBeforeVat);
  const cost = roundMoney(costBeforeVat);
  const gp = roundMoney(revenue - cost);
  const marginPercent =
    revenue > 0 ? Math.round((gp / revenue) * 10000) / 100 : 0;

  return { revenue, cost, gp, marginPercent };
}

export function computeNetVatPayable(outputVat: number, inputVat: number) {
  return roundMoney(outputVat - inputVat);
}

export function aggregateInvoiceTotals(
  lines: Pick<VatLineResult, "beforeVat" | "vatAmount" | "afterVat" | "exempt">[]
) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.beforeVat, 0));
  const taxAmount = roundMoney(lines.reduce((sum, line) => sum + line.vatAmount, 0));
  const total = roundMoney(lines.reduce((sum, line) => sum + line.afterVat, 0));
  const allExempt = lines.length > 0 && lines.every((line) => line.exempt);

  return { subtotal, taxAmount, total, allExempt };
}
