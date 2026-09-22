/** Vendor IO amount reflects creator cost (ex-VAT), not client revenue. */
export function resolveVendorIoLineAmount(line: {
  cost_before_vat?: number | null;
  cost?: number | null;
  revenue_before_vat?: number | null;
  revenue?: number | null;
}): number {
  const cost = Number(line.cost_before_vat ?? line.cost ?? 0);
  if (cost > 0) return cost;
  return Number(line.revenue_before_vat ?? line.revenue ?? 0);
}

export function sumVendorIoLineAmounts(
  lines: Array<{
    cost_before_vat?: number | null;
    cost?: number | null;
    revenue_before_vat?: number | null;
    revenue?: number | null;
  }>
): number {
  return lines.reduce((sum, line) => sum + resolveVendorIoLineAmount(line), 0);
}

/** Stored IO amount is ex-VAT; document Total Due includes the separate tax amount. */
export function resolveVendorIoTotalDue(storedFee: number, fallbackFee: number, vatAmount: number): number {
  return Math.round(((storedFee || fallbackFee) + vatAmount + Number.EPSILON) * 100) / 100;
}
