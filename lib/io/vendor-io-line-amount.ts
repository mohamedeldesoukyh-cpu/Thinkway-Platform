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
