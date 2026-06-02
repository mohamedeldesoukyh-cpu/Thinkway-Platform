import type { SupabaseClient } from "@supabase/supabase-js";

import { devLog } from "@/lib/dev-log";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

type LineItemLink = {
  deliverable_id: string | null;
  post_id: string | null;
  line_id: string | null;
  revenue_before_vat: number;
  document_number: string | null;
  invoice_status: string | null;
};

export async function loadOperationalInvoiceLinkage(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<LineItemLink[]> {
  const { data, error } = await supabase
    .from("invoice_line_items")
    .select(
      `
      assignment_deliverable_id,
      assignment_post_schedule_id,
      campaign_line_id,
      revenue_before_vat,
      invoice:invoices!inner(document_number, status)
    `
    )
    .eq("campaign_header_id", campaignHeaderId);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      devLog("[operational-invoice-sync] linkage query failed", {
        campaignHeaderId,
        error: error.message,
      });
    }
    return [];
  }

  return (data ?? []).map((row) => {
    const typed = row as unknown as {
      assignment_deliverable_id: string | null;
      assignment_post_schedule_id: string | null;
      campaign_line_id: string | null;
      revenue_before_vat: number;
      invoice: { document_number: string; status: string } | null;
    };
    if (typed.invoice?.status === "void") {
      return null;
    }
    return {
      deliverable_id: typed.assignment_deliverable_id,
      post_id: typed.assignment_post_schedule_id,
      line_id: typed.campaign_line_id,
      revenue_before_vat: Number(typed.revenue_before_vat ?? 0),
      document_number: typed.invoice?.document_number ?? null,
      invoice_status: typed.invoice?.status ?? null,
    };
  }).filter((row): row is LineItemLink => Boolean(row));
}

function applyLinkageToRow(
  row: OperationalBillingRow,
  links: LineItemLink[]
): OperationalBillingRow {
  const rowLinks = links.filter((link) => {
    if (row.kind === "post" && link.post_id === row.id) return true;
    if (row.kind === "deliverable_group" && link.deliverable_id === row.id) return true;
    if (row.kind === "assignment" && link.line_id === row.id) return true;
    return false;
  });

  const children = row.children.map((child) => applyLinkageToRow(child, links));
  const childInvoiced = children.reduce((sum, child) => sum + child.invoiced_amount, 0);
  const childRemaining = children.reduce((sum, child) => sum + child.remaining_amount, 0);

  const directLineInvoiced = roundMoney(
    rowLinks.reduce((sum, link) => sum + link.revenue_before_vat, 0)
  );
  const invoiceDoc =
    rowLinks.find((link) => link.document_number)?.document_number ??
    row.invoice_document_number;

  const invoiced_amount =
    children.length > 0
      ? roundMoney(Math.max(childInvoiced, row.invoiced_amount))
      : roundMoney(Math.max(row.invoiced_amount, directLineInvoiced));

  const remaining_amount =
    children.length > 0
      ? childRemaining
      : Math.max(0, roundMoney(row.billable_amount - invoiced_amount));

  const is_locked = Boolean(
    row.is_locked || row.invoice_line_item_id || invoiced_amount >= row.billable_amount
  );

  return {
    ...row,
    children,
    invoice_document_number: invoiceDoc ?? row.invoice_document_number,
    invoiced_amount,
    remaining_amount,
    is_locked,
    is_invoice_eligible: !is_locked && remaining_amount > 0,
  };
}

export function applyOperationalInvoiceLinkage(
  rows: OperationalBillingRow[],
  links: LineItemLink[]
): OperationalBillingRow[] {
  if (links.length === 0) return rows;
  const enriched = rows.map((row) => applyLinkageToRow(row, links));

  if (process.env.NODE_ENV === "development") {
    devLog("[operational-invoice-sync] applied invoice linkage to operational tree", {
      linkCount: links.length,
      assignmentCount: rows.length,
    });
  }

  return enriched;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
