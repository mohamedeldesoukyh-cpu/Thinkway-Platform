import type { SupabaseClient } from "@supabase/supabase-js";

import { isActiveInvoiceForFinancialTotals } from "@/lib/billing/invoice-status";
import {
  getRemainingRevenue,
  isFullyInvoicedBillingStatus,
} from "@/lib/billing/partial-invoice-lifecycle";
import {
  traceChildrenAccess,
  traceOperationalTreeStage,
} from "@/lib/billing/operational-billing-trace";
import { devLog } from "@/lib/dev-log";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

type LineItemLink = {
  invoice_id: string;
  deliverable_id: string | null;
  post_id: string | null;
  line_id: string | null;
  revenue_before_vat: number;
  document_number: string | null;
  invoice_status: string | null;
  regeneration_status: string | null;
};

export async function loadOperationalInvoiceLinkage(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<LineItemLink[]> {
  const { data: campaignInvoices, error: invoiceError } = await supabase
    .from("invoices")
    .select("id")
    .or(`campaign_header_id.eq.${campaignHeaderId},campaign_id.eq.${campaignHeaderId}`)
    .neq("status", "void");

  if (invoiceError) {
    if (process.env.NODE_ENV === "development") {
      devLog("[operational-invoice-sync] linkage invoice query failed", {
        campaignHeaderId,
        error: invoiceError.message,
      });
    }
    return [];
  }

  const invoiceIds = (campaignInvoices ?? []).map((row) => (row as { id: string }).id);
  if (invoiceIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("invoice_line_items")
    .select(
      `
      assignment_deliverable_id,
      assignment_post_schedule_id,
      campaign_line_id,
      revenue_before_vat,
      invoice:invoices!inner(id, document_number, status, regeneration_status)
    `
    )
    .in("invoice_id", invoiceIds);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      devLog("[operational-invoice-sync] linkage query failed", {
        campaignHeaderId,
        error: error.message,
      });
    }
    return [];
  }

  const links: LineItemLink[] = [];

  for (const row of data ?? []) {
    const typed = row as unknown as {
      assignment_deliverable_id: string | null;
      assignment_post_schedule_id: string | null;
      campaign_line_id: string | null;
      revenue_before_vat: number;
      invoice: {
        id: string;
        document_number: string;
        status: string;
        regeneration_status: string | null;
      } | null;
    };
    if (
      !typed.invoice ||
      !isActiveInvoiceForFinancialTotals({
        status: typed.invoice.status,
        regeneration_status: typed.invoice.regeneration_status,
      })
    ) {
      continue;
    }
    links.push({
      invoice_id: typed.invoice.id,
      deliverable_id: typed.assignment_deliverable_id,
      post_id: typed.assignment_post_schedule_id,
      line_id: typed.campaign_line_id,
      revenue_before_vat: Number(typed.revenue_before_vat ?? 0),
      document_number: typed.invoice.document_number ?? null,
      invoice_status: typed.invoice.status ?? null,
      regeneration_status: typed.invoice.regeneration_status ?? null,
    });
  }

  const linkedInvoiceIds = new Set(links.map((link) => link.invoice_id));

  const { data: pendingInvoices } = await supabase
    .from("invoices")
    .select("id, document_number, status, regeneration_status")
    .or(
      `campaign_header_id.eq.${campaignHeaderId},campaign_id.eq.${campaignHeaderId}`
    )
    .eq("regeneration_status", "pending_regeneration")
    .neq("status", "void");

  if (pendingInvoices?.length) {
    const { data: campaignLines } = await supabase
      .from("campaign_lines")
      .select("id")
      .eq("campaign_header_id", campaignHeaderId);

    for (const invoice of pendingInvoices) {
      const inv = invoice as {
        id: string;
        document_number: string;
        status: string;
        regeneration_status: string | null;
      };
      if (linkedInvoiceIds.has(inv.id)) continue;

      for (const line of campaignLines ?? []) {
        links.push({
          invoice_id: inv.id,
          deliverable_id: null,
          post_id: null,
          line_id: (line as { id: string }).id,
          revenue_before_vat: 0,
          document_number: inv.document_number ?? null,
          invoice_status: inv.status ?? null,
          regeneration_status: inv.regeneration_status ?? null,
        });
      }
    }
  }

  return links;
}

const INVOICED_DELIVERABLE_STATUSES = new Set([
  "invoiced",
  "partially_invoiced",
  "collected",
  "partially_collected",
]);

/**
 * Pending regeneration: keep invoice linkage for regenerate UX.
 * Active regeneration: line items are the billed truth (queue hides when fully invoiced).
 * Otherwise: only count linkage while rows are operationally locked/invoiced.
 */
function operationalRowStillLinkedToInvoice(
  row: OperationalBillingRow,
  link: LineItemLink
): boolean {
  if (link.regeneration_status === "pending_regeneration") {
    return true;
  }

  if (link.regeneration_status === "active") {
    if (row.kind === "deliverable_group" && link.deliverable_id) {
      return link.deliverable_id === row.assignment_deliverable_id;
    }
    if (row.kind === "post" && link.post_id) {
      return link.post_id === row.id;
    }
    if (row.kind === "assignment" && link.line_id === row.id) {
      if (!link.deliverable_id && !link.post_id) return true;
      // Line-level invoice items without deliverable rows in the operational tree.
      if ((row.children?.length ?? 0) === 0) return true;
      return false;
    }
    return false;
  }

  if (row.kind === "assignment") {
    if (link.line_id === row.id && !link.deliverable_id && !link.post_id) {
      return (
        Boolean(row.invoice_id && row.invoice_id === link.invoice_id) ||
        isFullyInvoicedBillingStatus(row.line_billing_status ?? row.billing_status) ||
        INVOICED_DELIVERABLE_STATUSES.has(row.billing_status)
      );
    }
    return Boolean(row.invoice_id && row.invoice_id === link.invoice_id);
  }

  return (
    Boolean(row.locked_at) ||
    Boolean(row.invoice_line_item_id) ||
    INVOICED_DELIVERABLE_STATUSES.has(row.billing_status)
  );
}

function applyLinkageToRow(
  row: OperationalBillingRow,
  links: LineItemLink[]
): OperationalBillingRow {
  const rowLinks = links.filter((link) => {
    const matches =
      (row.kind === "post" && link.post_id === row.id) ||
      (row.kind === "deliverable_group" && link.deliverable_id === row.id) ||
      (row.kind === "assignment" && link.line_id === row.id);
    if (!matches) return false;
    return operationalRowStillLinkedToInvoice(row, link);
  });

  traceChildrenAccess("applyLinkageToRow:children.map", row, "map");
  const children = row.children.map((child) => applyLinkageToRow(child, links));
  const childInvoiced = children.reduce((sum, child) => sum + child.invoiced_amount, 0);

  const directLineInvoiced = roundMoney(
    rowLinks.reduce((sum, link) => sum + link.revenue_before_vat, 0)
  );
  const primaryLink = rowLinks[0];
  const invoiceDoc =
    primaryLink?.document_number ?? row.invoice_document_number;

  const invoiced_amount = roundMoney(
    Math.max(row.invoiced_amount, directLineInvoiced, children.length > 0 ? childInvoiced : 0)
  );

  const remaining_amount = Math.max(
    0,
    roundMoney(row.billable_amount - invoiced_amount)
  );

  const partialParentLinkage =
    directLineInvoiced > 0.01 && directLineInvoiced < row.billable_amount - 0.01;

  const settledChildren =
    children.length > 0 && remaining_amount <= 0.01
      ? children.map((child) => {
          const childRemaining = getRemainingRevenue(child);
          const hasStaleInvoicePointer = Boolean(
            child.invoice_line_item_id || child.locked_at
          );
          if (
            childRemaining > 0.01 &&
            (partialParentLinkage || hasStaleInvoicePointer)
          ) {
            return child;
          }
          return {
            ...child,
            invoiced_amount: child.billable_amount,
            remaining_amount: 0,
            is_locked: true,
            is_invoice_eligible: false,
          };
        })
      : children;

  const linkedInvoiceId = primaryLink?.invoice_id ?? row.linked_invoice_id ?? row.invoice_id;
  const regenerationStatus =
    primaryLink?.regeneration_status ?? row.invoice_regeneration_status ?? null;
  const pendingRegeneration = regenerationStatus === "pending_regeneration";

  if (pendingRegeneration) {
    const remaining = roundMoney(
      children.length > 0
        ? children.reduce((sum, child) => sum + getRemainingRevenue(child), 0)
        : getRemainingRevenue(row)
    );
    const pendingChildren =
      linkedInvoiceId && children.length > 0
        ? settledChildren.map((child) => ({
            ...child,
            linked_invoice_id: child.linked_invoice_id ?? linkedInvoiceId,
            invoice_regeneration_status:
              child.invoice_regeneration_status ?? regenerationStatus,
            is_invoice_eligible:
              getRemainingRevenue(child) > 0.01 ||
              Boolean(
                child.invoice_line_item_id ??
                  child.linked_invoice_id ??
                  child.invoice_id ??
                  linkedInvoiceId
              ),
          }))
        : settledChildren;
    return {
      ...row,
      children: pendingChildren,
      linked_invoice_id: linkedInvoiceId,
      invoice_regeneration_status: regenerationStatus,
      invoice_document_number: invoiceDoc ?? row.invoice_document_number,
      invoiced_amount: children.length > 0 ? roundMoney(childInvoiced) : row.invoiced_amount,
      remaining_amount: remaining,
      is_locked: Boolean(row.locked_at),
      is_invoice_eligible: remaining > 0.01 && Boolean(linkedInvoiceId),
    };
  }

  const is_locked =
    remaining_amount <= 0.01 &&
    Boolean(
      row.locked_at ||
        row.invoice_line_item_id ||
        row.is_locked ||
        invoiced_amount >= row.billable_amount
    );

  return {
    ...row,
    children: settledChildren,
    linked_invoice_id: linkedInvoiceId,
    invoice_regeneration_status: regenerationStatus,
    invoice_document_number: invoiceDoc ?? row.invoice_document_number,
    invoiced_amount,
    remaining_amount,
    is_locked,
    is_invoice_eligible:
      pendingRegeneration || (!is_locked && remaining_amount > 0),
  };
}

export function applyOperationalInvoiceLinkage(
  rows: OperationalBillingRow[],
  links: LineItemLink[]
): OperationalBillingRow[] {
  if (links.length === 0) return rows;
  traceOperationalTreeStage("applyOperationalInvoiceLinkage:input", rows);
  const enriched = rows.map((row) => applyLinkageToRow(row, links));
  traceOperationalTreeStage("applyOperationalInvoiceLinkage:output", enriched);

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
