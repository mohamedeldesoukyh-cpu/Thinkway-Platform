import type { CampaignLineBillingStatus } from "@/features/billing/types";
import {
  aggregateRollupFromLeaves,
  deriveCampaignBillingStatus,
  flattenOperationalLeaves,
  type CampaignFinancialRollup,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";

export type CampaignBillingQueueFilter =
  | "all"
  | "invoiced"
  | "partially_invoiced"
  | "not_invoiced"
  | "fully_achieved"
  | "partially_achieved"
  | "draft"
  | "approved"
  | "moved_to_billing";

export type CampaignBillingQueueRow = {
  campaign_header_id: string;
  campaign_document_number: string;
  campaign_name: string;
  client_id: string;
  client_name: string;
  brand_name: string | null;
  legal_entity_name: string | null;
  currency_code: string;
  billing_status: CampaignLineBillingStatus;
  total_campaign_amount: number;
  achieved_revenue: number;
  already_invoiced: number;
  remaining_to_invoice: number;
  unachieved_revenue: number;
  assignment_count: number;
  operational_row_count: number;
};

export function buildCampaignQueueRow(input: {
  campaign_header_id: string;
  campaign_document_number: string;
  campaign_name: string;
  client_id: string;
  client_name: string;
  brand_name: string | null;
  legal_entity_name: string | null;
  currency_code: string;
  operational_rows: OperationalBillingRow[];
  /** Fallback when no operational rows exist (legacy campaigns). */
  legacy_line_revenue?: number;
  legacy_invoiced?: number;
}): CampaignBillingQueueRow {
  const leaves = flattenOperationalLeaves(input.operational_rows);
  const assignment_count = input.operational_rows.filter((r) => r.kind === "assignment").length;

  let rollup: Pick<
    CampaignFinancialRollup,
    | "total_campaign_amount"
    | "achieved_revenue"
    | "already_invoiced"
    | "remaining_to_invoice"
    | "unachieved_revenue"
  >;

  if (leaves.length > 0) {
    rollup = aggregateRollupFromLeaves(leaves);
  } else {
    const total = input.legacy_line_revenue ?? 0;
    const invoiced = input.legacy_invoiced ?? 0;
    rollup = {
      total_campaign_amount: total,
      achieved_revenue: total,
      already_invoiced: invoiced,
      remaining_to_invoice: Math.max(0, total - invoiced),
      unachieved_revenue: 0,
    };
  }

  const billing_status =
    input.operational_rows.length > 0
      ? deriveCampaignBillingStatus(input.operational_rows)
      : ("draft" as CampaignLineBillingStatus);

  const row: CampaignBillingQueueRow = {
    campaign_header_id: input.campaign_header_id,
    campaign_document_number: input.campaign_document_number,
    campaign_name: input.campaign_name,
    client_id: input.client_id,
    client_name: input.client_name,
    brand_name: input.brand_name,
    legal_entity_name: input.legal_entity_name,
    currency_code: input.currency_code,
    billing_status,
    assignment_count,
    operational_row_count: leaves.length,
    ...rollup,
  };

  if (process.env.NODE_ENV === "development") {
    console.debug("[billing-queue] campaign row", {
      campaignId: row.campaign_header_id,
      name: row.campaign_name,
      achieved: row.achieved_revenue,
      invoiced: row.already_invoiced,
      remaining: row.remaining_to_invoice,
    });
  }

  return row;
}

export function filterCampaignQueueRows(
  rows: CampaignBillingQueueRow[],
  filter: CampaignBillingQueueFilter
): CampaignBillingQueueRow[] {
  if (filter === "all") return rows;

  return rows.filter((row) => {
    switch (filter) {
      case "invoiced":
        return row.already_invoiced >= row.achieved_revenue && row.achieved_revenue > 0;
      case "partially_invoiced":
        return row.already_invoiced > 0 && row.remaining_to_invoice > 0;
      case "not_invoiced":
        return row.already_invoiced <= 0 && row.achieved_revenue > 0;
      case "fully_achieved":
        return row.unachieved_revenue <= 0 && row.total_campaign_amount > 0;
      case "partially_achieved":
        return row.unachieved_revenue > 0 && row.achieved_revenue > 0;
      case "draft":
        return row.billing_status === "draft";
      case "approved":
        return row.billing_status === "approved";
      case "moved_to_billing":
        return row.billing_status === "moved_to_billing";
      default:
        return true;
    }
  });
}

/** Appendable invoice statuses for row append flow. */
export const APPENDABLE_INVOICE_STATUSES = new Set(["draft", "sent", "partial"]);

export function isInvoiceAppendable(input: {
  status: string;
  regeneration_status: string | null;
  currency: string;
  client_id: string;
  campaign_header_id: string | null;
  target_currency: string;
  target_client_id: string;
  target_campaign_id: string;
}): boolean {
  if (input.client_id !== input.target_client_id) return false;
  if (input.currency !== input.target_currency) return false;
  if (input.campaign_header_id && input.campaign_header_id !== input.target_campaign_id) {
    return false;
  }
  if (!APPENDABLE_INVOICE_STATUSES.has(input.status)) return false;
  if (input.status === "void" || input.status === "paid") return false;
  if (input.regeneration_status === "pending_regeneration") return false;
  return true;
}
