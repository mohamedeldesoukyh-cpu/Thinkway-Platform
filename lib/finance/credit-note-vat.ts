function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type CreditNoteVatInput = {
  /** CN amount before VAT (revenue reduction). */
  amount_before_vat: number;
  /** Source invoice/subtotal before VAT. */
  source_revenue_before_vat: number;
  /** Source invoice VAT amount. */
  source_vat_amount: number;
  vat_affected: boolean;
};

export type CreditNoteVatResult = {
  amount_before_vat: number;
  vat_amount: number;
  amount_after_vat: number;
};

/**
 * Proportional VAT reduction when vat_affected = true.
 * When false, only revenue is reduced; VAT unchanged on CN (vat_amount = 0 on note).
 */
export function computeAdjustmentVatAmounts(
  input: CreditNoteVatInput
): CreditNoteVatResult {
  const amount_before_vat = roundMoney(Math.max(0, input.amount_before_vat));

  if (!input.vat_affected || amount_before_vat <= 0) {
    return {
      amount_before_vat,
      vat_amount: 0,
      amount_after_vat: amount_before_vat,
    };
  }

  const sourceRevenue = roundMoney(Math.max(0, input.source_revenue_before_vat));
  const sourceVat = roundMoney(Math.max(0, input.source_vat_amount));

  if (sourceRevenue <= 0 || sourceVat <= 0) {
    return {
      amount_before_vat,
      vat_amount: 0,
      amount_after_vat: amount_before_vat,
    };
  }

  const vat_rate = sourceVat / sourceRevenue;
  const vat_amount = roundMoney(amount_before_vat * vat_rate);

  return {
    amount_before_vat,
    vat_amount,
    amount_after_vat: roundMoney(amount_before_vat + vat_amount),
  };
}
