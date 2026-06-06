import type { SupabaseClient } from "@supabase/supabase-js";

import { deliverableDisplayLabel } from "@/lib/billing/deliverable-billing";

export type InvoiceLineRegistryRow = {
  id: string;
  invoice_id: string;
  campaign_line_id: string | null;
  assignment_deliverable_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  revenue_before_vat: number;
  revenue_vat_percent: number;
  revenue_vat_amount: number;
  revenue_vat_exempt: boolean;
  sort_order: number;
  line_document_number: string | null;
  deliverable_label: string | null;
};

export type InvoiceLineTotals = {
  revenue_before_vat: number;
  vat_amount: number;
  revenue_after_vat: number;
  line_count: number;
};

export class InvoiceLineIntegrityError extends Error {
  constructor(
    message: string,
    public readonly invoiceId: string
  ) {
    super(message);
    this.name = "InvoiceLineIntegrityError";
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getInvoiceLineTotals(lines: InvoiceLineRegistryRow[]): InvoiceLineTotals {
  let revenue_before_vat = 0;
  let vat_amount = 0;

  for (const line of lines) {
    revenue_before_vat += line.revenue_before_vat;
    vat_amount += line.revenue_vat_amount;
  }

  return {
    revenue_before_vat: roundMoney(revenue_before_vat),
    vat_amount: roundMoney(vat_amount),
    revenue_after_vat: roundMoney(revenue_before_vat + vat_amount),
    line_count: lines.length,
  };
}

export function validateInvoiceLineIntegrity(input: {
  invoiceId: string;
  headerTotal: number;
  lines: InvoiceLineRegistryRow[];
}): void {
  if (input.headerTotal <= 0) return;
  if (input.lines.length > 0) return;

  throw new InvoiceLineIntegrityError(
    `Invoice ${input.invoiceId} has totals but no persisted line items.`,
    input.invoiceId
  );
}

/** Load persisted invoice lines (no lifecycle filters). */
export async function getInvoiceLines(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{ lines: InvoiceLineRegistryRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("invoice_line_items")
    .select(
      `
      id,
      invoice_id,
      campaign_line_id,
      assignment_deliverable_id,
      description,
      quantity,
      unit_price,
      line_total,
      revenue_before_vat,
      revenue_vat_percent,
      revenue_vat_amount,
      revenue_vat_exempt,
      sort_order
    `
    )
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });

  if (error) {
    return { lines: [], error: error.message };
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const lineIds = [
    ...new Set(
      rows
        .map((row) => row.campaign_line_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];
  const deliverableIds = [
    ...new Set(
      rows
        .map((row) => row.assignment_deliverable_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];

  const [lineDocs, deliverables] = await Promise.all([
    lineIds.length > 0
      ? supabase
          .from("campaign_lines")
          .select(`id, document_number`)
          .in("id", lineIds)
      : Promise.resolve({ data: [], error: null }),
    deliverableIds.length > 0
      ? supabase
          .from("assignment_deliverables")
          .select("id, platform, deliverable_type, sort_order, quantity")
          .in("id", deliverableIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const lineDocMap = new Map(
    (lineDocs.data ?? []).map((row) => [
      (row as { id: string }).id,
      (row as { document_number: string }).document_number,
    ])
  );
  const deliverableMap = new Map(
    (deliverables.data ?? []).map((row) => [
      (row as { id: string }).id,
      deliverableDisplayLabel(
        row as {
          platform: string;
          deliverable_type: string;
          sort_order: number;
          quantity: number;
        }
      ),
    ])
  );

  const lines: InvoiceLineRegistryRow[] = rows.map((row) => {
    const lineId = row.campaign_line_id as string | null;
    const deliverableId = row.assignment_deliverable_id as string | null;
    const beforeVat = Number(row.revenue_before_vat ?? row.unit_price ?? 0);
    const vatAmount = Number(row.revenue_vat_amount ?? 0);
    const lineTotal = Number(row.line_total ?? beforeVat + vatAmount);

    return {
      id: String(row.id),
      invoice_id: String(row.invoice_id),
      campaign_line_id: lineId,
      assignment_deliverable_id: deliverableId,
      description: String(row.description ?? ""),
      quantity: Number(row.quantity ?? 1),
      unit_price: Number(row.unit_price ?? beforeVat),
      line_total: lineTotal,
      revenue_before_vat: beforeVat,
      revenue_vat_percent: Number(row.revenue_vat_percent ?? 0),
      revenue_vat_amount: vatAmount,
      revenue_vat_exempt: Boolean(row.revenue_vat_exempt),
      sort_order: Number(row.sort_order ?? 0),
      line_document_number: lineId ? (lineDocMap.get(lineId) ?? null) : null,
      deliverable_label: deliverableId ? (deliverableMap.get(deliverableId) ?? null) : null,
    };
  });

  return { lines };
}

/** Operational context for invoice lines (assignment + deliverable refs). */
export async function getInvoiceOperationalLines(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{ lines: InvoiceLineRegistryRow[]; totals: InvoiceLineTotals; error?: string }> {
  const { lines, error } = await getInvoiceLines(supabase, invoiceId);
  if (error) {
    return { lines: [], totals: getInvoiceLineTotals([]), error };
  }

  return {
    lines,
    totals: getInvoiceLineTotals(lines),
  };
}

/** Reconcile header totals from persisted lines (read-path validation). */
export async function reconcileInvoiceHeaderFromLines(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{
  lines: InvoiceLineRegistryRow[];
  totals: InvoiceLineTotals;
  headerTotal: number;
  integrityWarning?: string;
}> {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, total, subtotal, tax_amount")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return {
      lines: [],
      totals: getInvoiceLineTotals([]),
      headerTotal: 0,
      integrityWarning: invoiceError?.message ?? "Invoice not found",
    };
  }

  const { lines, error: linesError } = await getInvoiceLines(supabase, invoiceId);
  const headerTotal = Number((invoice as { total: number }).total ?? 0);
  const totals = getInvoiceLineTotals(lines);

  if (linesError) {
    return { lines, totals, headerTotal, integrityWarning: linesError };
  }

  try {
    validateInvoiceLineIntegrity({ invoiceId, headerTotal, lines });
  } catch (error) {
    if (error instanceof InvoiceLineIntegrityError) {
      console.warn("[invoice-line-registry] integrity warning", {
        invoiceId,
        headerTotal,
        lineCount: lines.length,
      });
      return { lines, totals, headerTotal, integrityWarning: error.message };
    }
    throw error;
  }

  return { lines, totals, headerTotal };
}
