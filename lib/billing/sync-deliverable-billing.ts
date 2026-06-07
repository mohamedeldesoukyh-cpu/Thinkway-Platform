import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import {
  assignmentDeliverableBillingSelect,
  queryAssignmentDeliverables,
  resolveDeliverableVatExempt,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deriveLineBillingStatusFromDeliverables,
  resolveConsensusLineInvoiceId,
  type DeliverableBillingRow,
} from "@/lib/billing/deliverable-billing";
import { resolveLinkedInvoiceIds } from "@/lib/billing/invoice-validation-context";
import { syncLineOperationalStatus } from "@/lib/billing/sync-line-operational-status";
import { repairCampaignLineStatusPatch } from "@/lib/campaigns/campaign-line-status-invariants";

function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

type LineRow = {
  id: string;
  campaign_header_id: string;
  document_number: string;
  name: string;
  platform: string | null;
  revenue: number;
  revenue_before_vat: number;
  revenue_vat_percent: number;
  revenue_vat_amount: number;
  revenue_after_vat: number;
  revenue_vat_exempt: boolean;
  cost: number;
  cost_before_vat: number;
  cost_vat_percent: number;
  cost_vat_amount: number;
  cost_after_vat: number;
  cost_vat_exempt: boolean;
  billing_status: string;
  pricing_mode?: string | null;
};

/**
 * Legacy synthetic deliverable auto-insert removed — deliverables must be created
 * explicitly via Create assignment / commercial sync before billing moves.
 */
export async function ensureBillableDeliverablesForLine(
  supabase: SupabaseClient,
  line: LineRow
): Promise<{ ok: boolean; message?: string }> {
  const { count } = await supabase
    .from("assignment_deliverables")
    .select("id", { count: "exact", head: true })
    .eq("campaign_line_id", line.id);

  if ((count ?? 0) > 0) {
    return { ok: true };
  }

  return {
    ok: false,
    message:
      "No deliverables on this assignment. Add deliverables via Create assignment before moving to billing.",
  };
}

export async function markDeliverablesReadyToInvoice(
  supabase: SupabaseClient,
  lineId: string
): Promise<void> {
  await supabase
    .from("assignment_deliverables")
    .update({ billing_status: "ready_to_invoice" })
    .eq("campaign_line_id", lineId)
    .in("billing_status", ["draft"]);
}

export async function syncLineBillingFromDeliverables(
  supabase: SupabaseClient,
  lineId: string,
  currentLineStatus: string,
  options?: { invoiceId?: string | null }
): Promise<void> {
  const { data: rows, includesVatExempt } = await queryAssignmentDeliverables<
    Omit<DeliverableBillingRow, "label"> & { revenue_vat_exempt?: boolean | null }
  >(async (select) => {
    const result = await supabase
      .from("assignment_deliverables")
      .select(select)
      .eq("campaign_line_id", lineId)
      .order("sort_order");
    return {
      data: (result.data ?? null) as Array<
        Omit<DeliverableBillingRow, "label"> & { revenue_vat_exempt?: boolean | null }
      > | null,
      error: result.error,
    };
  });

  const deliverables = (rows ?? []).map((row) => ({
    ...row,
    revenue_vat_exempt: resolveDeliverableVatExempt(row, includesVatExempt),
  })) as DeliverableBillingRow[];
  const nextStatus = deriveLineBillingStatusFromDeliverables(
    deliverables,
    currentLineStatus
  );

  const fullLock = deliverables.length > 0 && deliverables.every((d) => d.locked_at);
  const partialLock = deliverables.some((d) => d.locked_at);

  const linkedInvoiceByLineItem = await resolveLinkedInvoiceIds(
    supabase,
    deliverables.map((d) => d.invoice_line_item_id).filter(Boolean) as string[]
  );
  const resolvedInvoiceId =
    options?.invoiceId ??
    resolveConsensusLineInvoiceId(deliverables, linkedInvoiceByLineItem);

  const { data: lineRow } = await supabase
    .from("campaign_lines")
    .select("billing_status, operational_status, invoice_id, vendor_io_id, finance_override_until")
    .eq("id", lineId)
    .maybeSingle();

  const proposedPatch = {
    ...lineBillingPatch(nextStatus),
    ...(resolvedInvoiceId ? { invoice_id: resolvedInvoiceId } : {}),
  } as Record<string, string | null>;

  const statusPatch = lineRow
    ? repairCampaignLineStatusPatch(
        {
          ...(lineRow as {
            billing_status: string;
            operational_status: string;
            invoice_id: string | null;
            vendor_io_id: string | null;
            finance_override_until: string | null;
          }),
          invoice_id: lineRow.invoice_id ?? resolvedInvoiceId,
        },
        proposedPatch
      )
    : proposedPatch;

  await supabase
    .from("campaign_lines")
    .update({
      ...statusPatch,
      ...(resolvedInvoiceId && !statusPatch.invoice_id
        ? { invoice_id: resolvedInvoiceId }
        : {}),
      revenue_locked: fullLock,
      vat_locked: partialLock || fullLock,
    } as never)
    .eq("id", lineId);

  await syncLineOperationalStatus(supabase, lineId);
}

export async function unlockDeliverablesForInvoice(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<string[]> {
  const { data: items } = await supabase
    .from("invoice_line_items")
    .select("assignment_deliverable_id, campaign_line_id")
    .eq("invoice_id", invoiceId);

  const deliverableIds = (items ?? [])
    .map((i) => i.assignment_deliverable_id)
    .filter(Boolean) as string[];

  const lineIds = [
    ...new Set(
      (items ?? [])
        .map((i) => i.campaign_line_id)
        .filter(Boolean) as string[]
    ),
  ];

  if (deliverableIds.length > 0) {
    await supabase
      .from("assignment_deliverables")
      .update({
        billing_status: "ready_to_invoice",
        invoice_line_item_id: null,
        invoiced_amount: 0,
        invoiced_at: null,
        locked_at: null,
      })
      .in("id", deliverableIds);
  }

  return lineIds;
}
