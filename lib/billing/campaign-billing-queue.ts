import type { BillingLineRow } from "@/lib/domains/billing/types";
import type { CampaignLineBillingStatus } from "@/lib/domains/campaign/types";
import {
  deriveCampaignBillingStatus,
  flattenOperationalLeaves,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import { computeCampaignFinancialRollup } from "@/lib/billing/operational-financial-sync";
import { isCampaignBillingEligible } from "@/lib/billing/campaign-billing-eligibility";

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

  const rollup = computeCampaignFinancialRollup({
    operational_rows: input.operational_rows,
    legacy_line_revenue: input.legacy_line_revenue,
    legacy_invoiced: input.legacy_invoiced,
  });

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

/** Fallback queue builder from legacy billing line rows (one row per campaign). */
export function buildCampaignQueueFromBillingLines(
  lines: BillingLineRow[]
): CampaignBillingQueueRow[] {
  const byCampaign = new Map<
    string,
    {
      campaign_header_id: string;
      campaign_document_number: string;
      campaign_name: string;
      client_name: string;
      brand_name: string | null;
      currency_code: string;
      total_revenue: number;
      invoiced_revenue: number;
      assignment_count: number;
      billing_status: CampaignLineBillingStatus;
    }
  >();

  for (const line of lines) {
    const existing = byCampaign.get(line.campaign_header_id);
    const invoiced =
      ["invoiced", "partially_invoiced", "partially_paid", "paid", "closed"].includes(
        line.billing_status
      )
        ? line.revenue
        : 0;

    if (!existing) {
      byCampaign.set(line.campaign_header_id, {
        campaign_header_id: line.campaign_header_id,
        campaign_document_number: line.campaign_document_number,
        campaign_name: line.campaign_name,
        client_name: line.client_name,
        brand_name: line.brand_name,
        currency_code: line.currency_code,
        total_revenue: line.revenue,
        invoiced_revenue: invoiced,
        assignment_count: 1,
        billing_status: line.billing_status,
      });
      continue;
    }

    existing.total_revenue += line.revenue;
    existing.invoiced_revenue += invoiced;
    existing.assignment_count += 1;
    if (line.billing_status !== existing.billing_status) {
      existing.billing_status = "partially_invoiced";
    }
  }

  const rows = [...byCampaign.values()].map((entry) =>
    buildCampaignQueueRow({
      campaign_header_id: entry.campaign_header_id,
      campaign_document_number: entry.campaign_document_number,
      campaign_name: entry.campaign_name,
      client_id: "",
      client_name: entry.client_name,
      brand_name: entry.brand_name,
      legal_entity_name: null,
      currency_code: entry.currency_code,
      operational_rows: [],
      legacy_line_revenue: entry.total_revenue,
      legacy_invoiced: entry.invoiced_revenue,
    })
  );

  if (process.env.NODE_ENV === "development") {
    console.debug("[billing-queue] built from billing lines fallback", {
      lineCount: lines.length,
      campaignCount: rows.length,
    });
  }

  return rows;
}

/** Campaigns with zero remaining invoiceable revenue are fully invoiced — hide from default queue. */
export function filterCampaignsWithRemainingInvoiceable(
  rows: CampaignBillingQueueRow[],
  operationalRowsByCampaign?: Map<string, import("@/lib/billing/operational-billing-rows").OperationalBillingRow[]>
): CampaignBillingQueueRow[] {
  return rows.filter((row) => {
    if (row.remaining_to_invoice <= 0.01 && row.already_invoiced > 0) {
      return false;
    }
    const ops = operationalRowsByCampaign?.get(row.campaign_header_id);
    if (ops && ops.length > 0) {
      return isCampaignBillingEligible(ops);
    }
    return row.remaining_to_invoice > 0 || row.billing_status === "partially_invoiced";
  });
}

export function filterCampaignQueueRows(
  rows: CampaignBillingQueueRow[],
  filter: CampaignBillingQueueFilter
): CampaignBillingQueueRow[] {
  if (filter === "all") return rows;

  const filtered = rows.filter((row) => {
    switch (filter) {
      case "invoiced":
        return row.already_invoiced >= row.achieved_revenue && row.achieved_revenue > 0;
      case "partially_invoiced":
        return (
          row.billing_status === "partially_invoiced" ||
          (row.already_invoiced > 0 && row.remaining_to_invoice > 0)
        );
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

  if (process.env.NODE_ENV === "development") {
    console.debug("[queue-filter]", {
      filter,
      inputCount: rows.length,
      outputCount: filtered.length,
    });
  }

  return filtered;
}

/** Appendable invoice statuses for row append flow. */
export const APPENDABLE_INVOICE_STATUSES = new Set(["draft", "sent", "partial"]);

export function isInvoiceAppendable(input: {
  status: string;
  regeneration_status: string | null;
  is_operational_locked?: boolean | null;
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
  if (input.is_operational_locked) return false;
  if (!APPENDABLE_INVOICE_STATUSES.has(input.status)) return false;
  if (input.status === "void" || input.status === "paid") {
    return false;
  }
  if (input.regeneration_status === "pending_regeneration") {
    return false;
  }
  return true;
}
