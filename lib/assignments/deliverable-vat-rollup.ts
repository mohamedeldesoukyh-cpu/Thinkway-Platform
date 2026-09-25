import { roundMoney } from "@/lib/vat/calculations";

/** Sum stored child taxes; applying the parent's rate again loses mixed child rates. */
export function deliverableVatRollup(rows: Array<{
  revenue_before_vat: number; usage_rights_amount?: number; agency_fee_amount?: number;
  cost_before_vat: number; revenue_vat_amount?: number; cost_vat_amount?: number;
}>) {
  const revenueBase = roundMoney(rows.reduce((sum, row) => sum + Number(row.revenue_before_vat) + Number(row.usage_rights_amount ?? 0) + Number(row.agency_fee_amount ?? 0), 0));
  const costBase = roundMoney(rows.reduce((sum, row) => sum + Number(row.cost_before_vat), 0));
  const revenueVat = roundMoney(rows.reduce((sum, row) => sum + Number(row.revenue_vat_amount ?? 0), 0));
  const costVat = roundMoney(rows.reduce((sum, row) => sum + Number(row.cost_vat_amount ?? 0), 0));
  return {
    revenue_vat_amount: revenueVat, revenue_after_vat: roundMoney(revenueBase + revenueVat),
    revenue_vat_percent: revenueBase > 0 ? revenueVat / revenueBase * 100 : 0, revenue_vat_exempt: revenueVat === 0,
    cost_vat_amount: costVat, cost_after_vat: roundMoney(costBase + costVat),
    cost_vat_percent: costBase > 0 ? costVat / costBase * 100 : 0, cost_vat_exempt: costVat === 0,
  };
}
