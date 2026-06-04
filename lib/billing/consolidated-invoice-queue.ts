import {
  isOperationalRowInvoiceEligible,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  buildInvoiceSelectionBatch,
  selectAllOperationalRows,
  type OperationalSelectionPayload,
} from "@/lib/billing/operational-selection";
import { computeVatLine } from "@/lib/vat/calculations";

/** One consolidated invoice candidate per campaign + batch state. */
export type ConsolidatedInvoiceQueueRow = {
  batch_key: string;
  campaign_header_id: string;
  campaign_document_number: string;
  campaign_name: string;
  client_name: string;
  brand_name: string | null;
  currency_code: string;
  revenue_before_vat: number;
  vat_amount: number;
  revenue_after_vat: number;
  eligible_line_count: number;
};

const INVOICE_CANDIDATE_BATCH = "invoice_candidate";

/**
 * Builds consolidated queue rows (not assignment-level).
 * On a campaign workspace, typically returns 0–1 row for the current campaign.
 */
export function buildConsolidatedInvoiceQueueRows(input: {
  campaign_header_id: string;
  campaign_document_number: string;
  campaign_name: string;
  client_name: string;
  brand_name: string | null;
  currency_code: string;
  operational_rows: OperationalBillingRow[];
}): ConsolidatedInvoiceQueueRow[] {
  let revenue_before_vat = 0;
  let vat_amount = 0;
  let revenue_after_vat = 0;
  let eligible_line_count = 0;

  for (const row of input.operational_rows) {
    if (row.kind !== "assignment") continue;
    if (!isOperationalRowInvoiceEligible(row)) continue;

    const billable = Math.max(0, row.remaining_amount);
    if (billable <= 0) continue;

    const vat = computeVatLine({
      beforeVat: billable,
      vatPercent: row.revenue_vat_percent,
      exempt: row.revenue_vat_exempt,
    });

    revenue_before_vat += vat.beforeVat;
    vat_amount += vat.vatAmount;
    revenue_after_vat += vat.afterVat;
    eligible_line_count += 1;
  }

  if (eligible_line_count === 0) return [];

  return [
    {
      batch_key: INVOICE_CANDIDATE_BATCH,
      campaign_header_id: input.campaign_header_id,
      campaign_document_number: input.campaign_document_number,
      campaign_name: input.campaign_name,
      client_name: input.client_name,
      brand_name: input.brand_name,
      currency_code: input.currency_code,
      revenue_before_vat,
      vat_amount,
      revenue_after_vat,
      eligible_line_count,
    },
  ];
}

export function consolidatedQueueBatchLabel(batchKey: string): string {
  if (batchKey === INVOICE_CANDIDATE_BATCH) return "Ready to invoice";
  return batchKey;
}

/** Invoice payload for all UI-selectable lines under a consolidated queue row. */
export function buildConsolidatedQueueInvoiceSelection(
  operational_rows: OperationalBillingRow[]
): OperationalSelectionPayload {
  const selection = selectAllOperationalRows(operational_rows);
  return buildInvoiceSelectionBatch(selection, operational_rows);
}
