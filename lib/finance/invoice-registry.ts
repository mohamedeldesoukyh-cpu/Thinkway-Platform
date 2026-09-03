import { isActiveInvoiceForFinancialTotals } from "@/lib/finance/status/invoice-status";

export type InvoiceRegistryRow = {
  id: string;
  document_number: string;
  status: string;
  regeneration_status?: string | null;
  is_operational_locked?: boolean | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  vat_amount?: number | null;
  total?: number | null;
  revenue_before_vat?: number | null;
  revenue_vat_amount?: number | null;
  revenue_after_vat?: number | null;
  amount_paid?: number | null;
  currency?: string | null;
  campaign_header_id?: string | null;
};

export type InvoiceFinancialTotals = {
  revenue_before_vat: number;
  vat_amount: number;
  revenue_after_vat: number;
  count: number;
};

export type InvoiceOperationalState = {
  locked_status: "Locked" | "Pending regeneration" | "Open";
  is_active_for_totals: boolean;
  is_void: boolean;
};

export function getActiveInvoicesForCampaign(
  invoices: InvoiceRegistryRow[],
  campaignHeaderId: string
): InvoiceRegistryRow[] {
  return invoices.filter(
    (inv) =>
      inv.campaign_header_id === campaignHeaderId &&
      isActiveInvoiceForFinancialTotals({
        status: inv.status,
        regeneration_status: inv.regeneration_status,
      })
  );
}

export function getInvoiceFinancialTotals(
  invoices: InvoiceRegistryRow[],
  options?: { activeOnly?: boolean }
): InvoiceFinancialTotals {
  const activeOnly = options?.activeOnly !== false;
  const rows = activeOnly
    ? invoices.filter((inv) =>
        isActiveInvoiceForFinancialTotals({
          status: inv.status,
          regeneration_status: inv.regeneration_status,
        })
      )
    : invoices;

  let revenue_before_vat = 0;
  let vat_amount = 0;
  let revenue_after_vat = 0;

  for (const inv of rows) {
    revenue_before_vat += Number(inv.revenue_before_vat ?? inv.subtotal ?? 0);
    vat_amount += Number(inv.revenue_vat_amount ?? inv.tax_amount ?? 0);
    revenue_after_vat += Number(inv.revenue_after_vat ?? inv.total ?? 0);
  }

  return {
    revenue_before_vat: roundMoney(revenue_before_vat),
    vat_amount: roundMoney(vat_amount),
    revenue_after_vat: roundMoney(revenue_after_vat),
    count: rows.length,
  };
}

export function getInvoiceOperationalState(
  invoice: Pick<
    InvoiceRegistryRow,
    "status" | "regeneration_status" | "is_operational_locked"
  >
): InvoiceOperationalState {
  const is_void = invoice.status === "void";
  const financeFinalized =
    invoice.is_operational_locked ||
    invoice.status === "sent" ||
    invoice.status === "partial" ||
    invoice.status === "paid";

  const locked_status: InvoiceOperationalState["locked_status"] = is_void
    ? "Open"
    : financeFinalized
      ? "Locked"
      : invoice.regeneration_status === "pending_regeneration"
        ? "Pending regeneration"
        : "Open";

  return {
    locked_status,
    is_active_for_totals: isActiveInvoiceForFinancialTotals({
      status: invoice.status,
      regeneration_status: invoice.regeneration_status,
    }),
    is_void,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
