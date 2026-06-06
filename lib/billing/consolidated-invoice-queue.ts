import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import { isCampaignBillingEligible } from "@/lib/billing/campaign-billing-eligibility";
import { getRemainingInvoiceableDeliverables } from "@/lib/billing/queue-eligibility";
import { getRemainingRevenue } from "@/lib/billing/partial-invoice-lifecycle";
import {
  createEmptySelection,
  selectionToSubmitPayload,
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
  if (!isCampaignBillingEligible(input.operational_rows)) return [];

  const invoiceable = getRemainingInvoiceableDeliverables(input.operational_rows);
  const rowById = new Map<string, OperationalBillingRow>();
  const collectRows = (rows: OperationalBillingRow[]) => {
    for (const row of rows) {
      rowById.set(row.id, row);
      if (row.children?.length) collectRows(row.children);
    }
  };
  collectRows(input.operational_rows);

  let revenue_before_vat = 0;
  let vat_amount = 0;
  let revenue_after_vat = 0;
  const eligibleLineIds = new Set<string>();

  for (const ref of invoiceable) {
    const row = rowById.get(ref.id);
    if (!row) continue;

    const billable = ref.remaining_amount > 0 ? ref.remaining_amount : getRemainingRevenue(row);
    if (billable <= 0) continue;

    const vat = computeVatLine({
      beforeVat: billable,
      vatPercent: row.revenue_vat_percent,
      exempt: row.revenue_vat_exempt,
    });

    revenue_before_vat += vat.beforeVat;
    vat_amount += vat.vatAmount;
    revenue_after_vat += vat.afterVat;
    eligibleLineIds.add(row.campaign_line_id);
  }

  const eligible_line_count = eligibleLineIds.size;
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

/** Invoice payload for queue-eligible rows only (no parent assignment pollution). */
export function buildConsolidatedQueueInvoiceSelection(
  operational_rows: OperationalBillingRow[]
): OperationalSelectionPayload {
  const selection = createEmptySelection();
  const invoiceable = getRemainingInvoiceableDeliverables(operational_rows);

  for (const ref of invoiceable) {
    if (ref.kind === "assignment") selection.line_ids.add(ref.id);
    else if (ref.kind === "deliverable_group") selection.deliverable_ids.add(ref.id);
    else selection.post_ids.add(ref.id);
  }

  return selectionToSubmitPayload(selection, operational_rows);
}
