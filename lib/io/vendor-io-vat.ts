/** Prefer assignment-level VAT; rounded deliverable allocations can lose cents. */
export function resolveVendorIoVatAmount(
  lines: Array<{ id: string; cost_vat_amount?: number | null }>,
  deliverables: Array<{ campaign_line_id: string; cost_vat_amount?: number | null }>,
): number {
  const amount = lines.length
    ? lines.reduce((sum, line) => sum + (line.cost_vat_amount != null
      ? Number(line.cost_vat_amount)
      : deliverables.filter(row => row.campaign_line_id === line.id)
        .reduce((subtotal, row) => subtotal + Number(row.cost_vat_amount ?? 0), 0)), 0)
    : deliverables.reduce((sum, row) => sum + Number(row.cost_vat_amount ?? 0), 0);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
