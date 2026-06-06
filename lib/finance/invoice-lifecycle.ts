import type { SupabaseClient } from "@supabase/supabase-js";

import { regenerateInvoiceFromDeliverables } from "@/lib/billing/invoice-from-deliverables";
import { syncLineOperationalStatusBatch } from "@/lib/billing/sync-line-operational-status";
import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import { logFinanceAuditEvent } from "@/lib/finance/audit-log";
import { FINANCE_AUDIT_EVENTS } from "@/lib/finance/audit-events";
import { canUnpostInvoice } from "@/lib/finance/document-controls";
import {
  ensureInvoiceFinanceDocument,
  getLinkedAdjustmentsForInvoice,
  isInvoicePostedToErp,
  syncFinanceDocumentStatus,
} from "@/lib/finance/finance-document-registry";
import { guardVoidInvoice } from "@/lib/finance/integrity-guards";
import {
  lockInvoiceAssignments,
  unlockInvoiceAssignments,
} from "@/lib/finance/invoice-locks";
import { asFinanceControlClient } from "@/lib/finance/supabase-finance";
import { governanceDb } from "@/lib/supabase/governance-client";
import type { Database } from "@/types/database";

export type InvoiceLifecycleResult =
  | { ok: true; document_number: string; message: string }
  | { ok: false; error: string };

function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

export async function unpostInvoice(
  supabase: SupabaseClient<Database>,
  input: {
    invoice_id: string;
    actor_id: string;
    reason: string;
  }
): Promise<InvoiceLifecycleResult> {
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, total, subtotal, tax_amount, version_number, regeneration_status, status, is_operational_locked"
    )
    .eq("id", input.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, error: invError?.message ?? "Invoice not found." };
  }

  const inv = invoice as Record<string, unknown>;
  const linkedAdjustments = await getLinkedAdjustmentsForInvoice(supabase, input.invoice_id);
  const isPosted = await isInvoicePostedToErp(supabase, input.invoice_id);

  const unpostCheck = canUnpostInvoice({
    is_posted_to_erp: isPosted,
    linked_adjustments: linkedAdjustments,
  });

  if (!unpostCheck.allowed && isPosted) {
    return { ok: false, error: unpostCheck.reason ?? "Cannot unpost invoice." };
  }

  if (linkedAdjustments.length > 0) {
    return {
      ok: false,
      error: "Cannot unpost invoice while active CN/DN exist.",
    };
  }

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", input.invoice_id)
    .order("sort_order");

  await governanceDb(supabase).from("invoice_versions").insert({
    invoice_id: input.invoice_id,
    version_number: Number(inv.version_number ?? 1),
    snapshot: inv,
    line_items_snapshot: lineItems ?? [],
    total: Number(inv.total ?? 0),
    subtotal: Number(inv.subtotal ?? 0),
    tax_amount: Number(inv.tax_amount ?? 0),
    regeneration_reason: input.reason,
    regenerated_by: input.actor_id,
  });

  await unlockInvoiceAssignments(supabase, input.invoice_id);

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      regeneration_status: "pending_regeneration",
      status: "draft",
      is_operational_locked: false,
      ungenerated_at: new Date().toISOString(),
      ungenerated_by: input.actor_id,
      ungenerate_reason: input.reason,
    } as never)
    .eq("id", input.invoice_id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const financeDb = asFinanceControlClient(supabase);
  await syncFinanceDocumentStatus(financeDb, {
    source_table: "invoices",
    source_id: input.invoice_id,
    status: "draft",
    posted_at: null,
    posting_batch_id: null,
  });

  await governanceDb(supabase).from("finance_override_logs").insert({
    entity_type: "invoice",
    entity_id: input.invoice_id,
    override_type: "ungenerate",
    reason: input.reason,
    granted_by: input.actor_id,
    granted_until: new Date(Date.now() + 72 * 3600000).toISOString(),
  });

  await logFinanceAuditEvent(supabase, {
    event: FINANCE_AUDIT_EVENTS.invoice_unposted,
    entity_type: "invoice",
    entity_id: input.invoice_id,
    actor_id: input.actor_id,
    payload: {
      document_number: String(inv.document_number),
      reason: input.reason,
      campaign_header_id: inv.campaign_header_id,
    },
  });

  return {
    ok: true,
    document_number: String(inv.document_number),
    message: `Invoice ${inv.document_number} unposted. Assignments unlocked.`,
  };
}

export async function voidInvoice(
  supabase: SupabaseClient<Database>,
  input: {
    invoice_id: string;
    actor_id: string;
    reason: string;
  }
): Promise<InvoiceLifecycleResult> {
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, status, regeneration_status, amount_paid, total"
    )
    .eq("id", input.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, error: invError?.message ?? "Invoice not found." };
  }

  const inv = invoice as Record<string, unknown>;
  const linkedAdjustments = await getLinkedAdjustmentsForInvoice(supabase, input.invoice_id);

  const guard = guardVoidInvoice({
    status: String(inv.status),
    regeneration_status: inv.regeneration_status as string | null,
    amount_paid: Number(inv.amount_paid ?? 0),
    linked_adjustments: linkedAdjustments,
  });

  if (!guard.allowed) {
    return { ok: false, error: guard.reason };
  }

  await unlockInvoiceAssignments(supabase, input.invoice_id);

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      status: "void",
      is_operational_locked: false,
    } as never)
    .eq("id", input.invoice_id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await ensureInvoiceFinanceDocument(supabase, input.invoice_id, input.actor_id);
  const financeDb = asFinanceControlClient(supabase);
  await syncFinanceDocumentStatus(financeDb, {
    source_table: "invoices",
    source_id: input.invoice_id,
    status: "void",
    voided_at: now,
    posted_at: null,
    posting_batch_id: null,
  });

  await logFinanceAuditEvent(supabase, {
    event: FINANCE_AUDIT_EVENTS.invoice_voided,
    entity_type: "invoice",
    entity_id: input.invoice_id,
    actor_id: input.actor_id,
    old_data: { status: inv.status },
    new_data: { status: "void" },
    payload: {
      document_number: String(inv.document_number),
      reason: input.reason,
      campaign_header_id: inv.campaign_header_id,
    },
  });

  return {
    ok: true,
    document_number: String(inv.document_number),
    message: `Invoice ${inv.document_number} voided. Serial preserved; totals excluded from active rollups.`,
  };
}

export async function regenerateInvoice(
  supabase: SupabaseClient<Database>,
  input: {
    invoice_id: string;
    actor_id: string;
    reason: string;
    default_vat_rate?: number;
  }
): Promise<InvoiceLifecycleResult> {
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, version_number, regeneration_status"
    )
    .eq("id", input.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, error: invError?.message ?? "Invoice not found." };
  }

  const inv = invoice as Record<string, unknown>;

  if (inv.regeneration_status !== "pending_regeneration") {
    return {
      ok: false,
      error: "Only invoices pending regeneration can be regenerated.",
    };
  }

  const campaignHeaderId = String(inv.campaign_header_id ?? "");
  if (!campaignHeaderId) {
    return { ok: false, error: "Invoice has no campaign linkage." };
  }

  const deliverableRegen = await regenerateInvoiceFromDeliverables(
    supabase,
    input.invoice_id,
    campaignHeaderId,
    { defaultVatRate: input.default_vat_rate ?? 0 }
  );

  if (deliverableRegen.error) {
    return { ok: false, error: deliverableRegen.error };
  }

  const { data: refreshedInvoice, error: refreshError } = await supabase
    .from("invoices")
    .select("subtotal, tax_amount, total")
    .eq("id", input.invoice_id)
    .single();

  if (refreshError || !refreshedInvoice) {
    return { ok: false, error: refreshError?.message ?? "Failed to refresh totals." };
  }

  const subtotal = Number(refreshedInvoice.subtotal);
  const taxAmount = Number(refreshedInvoice.tax_amount);
  const total = Number(refreshedInvoice.total);
  const newVersion = Number(inv.version_number ?? 1) + 1;

  const { data: linkedLines } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("invoice_id", input.invoice_id);

  const lineIds = (linkedLines ?? []).map((l) => (l as { id: string }).id);

  const { error: invoiceUpdateError } = await supabase
    .from("invoices")
    .update({
      version_number: newVersion,
      regeneration_status: "regenerated",
      status: "draft",
      is_operational_locked: false,
    } as never)
    .eq("id", input.invoice_id);

  if (invoiceUpdateError) {
    return { ok: false, error: invoiceUpdateError.message };
  }

  if (lineIds.length > 0) {
    const now = new Date().toISOString();
    await supabase
      .from("campaign_lines")
      .update({
        ...lineBillingPatch("invoiced"),
        operational_status: "locked",
        revenue_locked: true,
        cost_locked: true,
        vendor_assignment_locked: true,
        vat_locked: true,
        finance_override_until: null,
        billing_invoiced_at: now,
        invoice_id: input.invoice_id,
      } as never)
      .in("id", lineIds);

    await syncLineOperationalStatusBatch(supabase, lineIds);
  }

  await lockInvoiceAssignments(supabase, input.invoice_id);

  await governanceDb(supabase).from("invoice_versions").insert({
    invoice_id: input.invoice_id,
    version_number: newVersion,
    snapshot: { total, subtotal, tax_amount: taxAmount },
    line_items_snapshot: [],
    total,
    subtotal,
    tax_amount: taxAmount,
    regeneration_reason: input.reason,
    regenerated_by: input.actor_id,
  });

  await logFinanceAuditEvent(supabase, {
    event: FINANCE_AUDIT_EVENTS.invoice_regenerated,
    entity_type: "invoice",
    entity_id: input.invoice_id,
    actor_id: input.actor_id,
    payload: {
      document_number: String(inv.document_number),
      reason: input.reason,
      version_number: newVersion,
    },
  });

  return {
    ok: true,
    document_number: String(inv.document_number),
    message: `Invoice ${inv.document_number} regenerated (v${newVersion}).`,
  };
}
