"use server";

import { revalidatePath } from "next/cache";

import { FINANCIAL_APPROVAL_CHAIN } from "@/features/billing/constants";
import { assignmentStatusFromBilling } from "@/features/campaigns/line-assignment";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOperationalPo } from "@/lib/finance/po/operational-budget";
import { governanceDb } from "@/lib/supabase/governance-client";
import { resolveClientBillingVatRate } from "@/lib/vat/queries";
import {
  fetchDeliverablesForInvoicing,
  lockDeliverablesOnInvoice,
  regenerateInvoiceFromDeliverables,
  resolveInvoiceDeliverableIds,
  validateDeliverablesForInvoice,
} from "@/lib/billing/invoice-from-deliverables";
import {
  ensureBillableDeliverablesForLine,
  markDeliverablesReadyToInvoice,
  syncLineBillingFromDeliverables,
  unlockDeliverablesForInvoice,
} from "@/lib/billing/sync-deliverable-billing";
import { syncDeliverableCollectionsForInvoice } from "@/lib/billing/sync-deliverable-collections";
import {
  resolveOperationalInvoiceTargets,
  validateAppendableInvoice,
} from "@/lib/billing/resolve-operational-invoice";

import {
  approveLineForBillingSchema,
  bulkOperationalBillingSchema,
  closeBillingLineSchema,
  createInvoiceFromLinesSchema,
  decideFinancialApprovalSchema,
  moveLineToBillingSchema,
  recordCollectionPaymentSchema,
  recordVendorPaymentSchema,
  regenerateInvoiceSchema,
  requestFinanceOverrideSchema,
  ungenerateInvoiceSchema,
} from "./schemas";
import { requirePermission } from "@/lib/auth/permissions";
import { getCampaignOperationalBillingDetail } from "@/features/billing/queries";

export type BillingActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  invoiceId?: string;
};

function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim();
}

function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

type CampaignLineForInvoice = {
  id: string;
  document_number: string;
  name: string;
  revenue: number;
  revenue_before_vat?: number | null;
  revenue_vat_percent?: number | null;
  revenue_vat_exempt?: boolean | null;
  billing_status: string;
  invoice_id: string | null;
};

function invoiceLinePayload(
  invoiceId: string,
  headerId: string,
  line: CampaignLineForInvoice,
  sortOrder: number
) {
  const beforeVat = Number(line.revenue_before_vat ?? line.revenue);
  const vatExempt = line.revenue_vat_exempt ?? false;
  const vatPercent = vatExempt ? 0 : Number(line.revenue_vat_percent ?? 0);

  return {
    invoice_id: invoiceId,
    campaign_line_id: line.id,
    campaign_header_id: headerId,
    campaign_id: headerId,
    sort_order: sortOrder,
    description: `${line.document_number} — ${line.name}`,
    quantity: 1,
    unit_price: beforeVat,
    revenue_before_vat: beforeVat,
    revenue_vat_percent: vatPercent,
    revenue_vat_exempt: vatExempt,
  };
}

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user, error: null };
}

function revalidateBilling(paths: { campaignId?: string; invoiceId?: string }) {
  revalidatePath("/billing");
  if (paths.campaignId) {
    revalidatePath(`/campaigns/${paths.campaignId}`);
  }
  if (paths.invoiceId) {
    revalidatePath(`/billing/invoices/${paths.invoiceId}`);
  }
}

async function createFinancialApprovalChain(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  input: {
    entity_type: string;
    entity_id: string;
    title: string;
    description?: string;
    stages?: typeof FINANCIAL_APPROVAL_CHAIN;
  }
): Promise<string | null> {
  const stages = input.stages ?? FINANCIAL_APPROVAL_CHAIN;
  for (let i = 0; i < stages.length; i++) {
    const { error } = await supabase.from("financial_approval_requests").insert({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      approval_stage: stages[i],
      chain_order: i + 1,
      title: `${input.title} — ${stages[i]}`,
      description: input.description ?? null,
      requested_by: userId,
      status: "pending",
    });
    if (error) {
      console.error("[billing] financial approval chain insert failed", {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        stage: stages[i],
        message: error.message,
      });
      return error.message;
    }
  }
  return null;
}

export async function approveLineForBillingAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = approveLineForBillingSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: line, error: fetchError } = await supabase
    .from("campaign_lines")
    .select("billing_status, document_number")
    .eq("id", parsed.data.line_id)
    .eq("campaign_header_id", parsed.data.campaign_id)
    .maybeSingle();

  if (fetchError || !line) {
    return { ok: false, message: fetchError?.message ?? "Line not found." };
  }

  if (line.billing_status !== "draft") {
    return { ok: false, message: "Only draft lines can be approved for billing." };
  }

  const { error } = await supabase
    .from("campaign_lines")
    .update({ billing_status: "approved" })
    .eq("id", parsed.data.line_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  const approvalError = await createFinancialApprovalChain(supabase, user.id, {
    entity_type: "campaign_line",
    entity_id: parsed.data.line_id,
    title: `Billing approval — ${line.document_number}`,
    description: "Campaign Manager approval for billing readiness",
    stages: ["campaign_manager"],
  });

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return {
    ok: true,
    message: approvalError
      ? "Line approved for billing. Approval workflow could not be recorded — apply billing migrations if needed."
      : "Line approved for billing.",
  };
}

export async function moveLineToBillingAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = moveLineToBillingSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const [{ data: line, error: fetchError }, { data: header, error: headerError }] =
    await Promise.all([
      supabase
        .from("campaign_lines")
        .select(
          "id, billing_status, document_number, po_amount, cost, revenue_before_vat, revenue, revenue_vat_percent, revenue_vat_amount, revenue_after_vat, revenue_vat_exempt, cost_before_vat, cost_vat_percent, cost_vat_amount, cost_after_vat, cost_vat_exempt, platform, campaign_header_id"
        )
        .eq("id", parsed.data.line_id)
        .eq("campaign_header_id", parsed.data.campaign_id)
        .maybeSingle(),
      supabase
        .from("campaign_headers")
        .select(
          "po_amount_campaign_currency, po_consumed_amount, po_remaining_amount, po_remaining_percent, po_status, po_expiry_date, po_override_approved"
        )
        .eq("id", parsed.data.campaign_id)
        .maybeSingle(),
    ]);

  if (fetchError || !line) {
    return { ok: false, message: fetchError?.message ?? "Line not found." };
  }

  if (headerError || !header) {
    return { ok: false, message: headerError?.message ?? "Campaign not found." };
  }

  if (!["approved", "draft"].includes(line.billing_status)) {
    return {
      ok: false,
      message: "Line must be approved before moving to billing.",
    };
  }

  const { data: siblingLines } = await supabase
    .from("campaign_lines")
    .select("po_amount, revenue_before_vat, revenue")
    .eq("campaign_header_id", parsed.data.campaign_id);

  const legacyBudget = (siblingLines ?? []).reduce(
    (sum, row) => sum + Number(row.po_amount ?? 0),
    0
  );
  const legacyConsumed = (siblingLines ?? []).reduce(
    (sum, row) =>
      sum + Number(row.revenue_before_vat ?? row.revenue ?? 0),
    0
  );

  const operationalPo = resolveOperationalPo({
    po_amount_campaign_currency: header.po_amount_campaign_currency,
    po_consumed_amount: header.po_consumed_amount,
    po_remaining_amount: header.po_remaining_amount,
    po_remaining_percent: header.po_remaining_percent,
    po_status: header.po_status,
    po_expiry_date: header.po_expiry_date,
    legacy_budget: legacyBudget,
    legacy_consumed: legacyConsumed,
  });

  if (
    operationalPo.po_exceeded &&
    !header.po_override_approved
  ) {
    return {
      ok: false,
      message:
        "Campaign PO exceeded. Finance override required before moving lines to billing.",
    };
  }

  if (
    !operationalPo.uses_governance &&
    Number(line.cost) > Number(line.po_amount) &&
    Number(line.po_amount) > 0
  ) {
    return {
      ok: false,
      message: "PO over-consumption detected. Finance review required before billing.",
    };
  }

  const { error } = await supabase
    .from("campaign_lines")
    .update({
      billing_status: "moved_to_billing",
      billing_moved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.line_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  await ensureBillableDeliverablesForLine(supabase, {
    id: line.id,
    campaign_header_id: line.campaign_header_id,
    document_number: line.document_number,
    name: line.document_number,
    platform: line.platform,
    revenue: Number(line.revenue),
    revenue_before_vat: Number(line.revenue_before_vat ?? line.revenue),
    revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
    revenue_vat_amount: Number(line.revenue_vat_amount ?? 0),
    revenue_after_vat: Number(line.revenue_after_vat ?? line.revenue),
    revenue_vat_exempt: line.revenue_vat_exempt ?? false,
    cost: Number(line.cost),
    cost_before_vat: Number(line.cost_before_vat ?? line.cost),
    cost_vat_percent: Number(line.cost_vat_percent ?? 0),
    cost_vat_amount: Number(line.cost_vat_amount ?? 0),
    cost_after_vat: Number(line.cost_after_vat ?? line.cost),
    cost_vat_exempt: line.cost_vat_exempt ?? false,
    billing_status: "moved_to_billing",
  });
  await markDeliverablesReadyToInvoice(supabase, parsed.data.line_id);

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return { ok: true, message: "Line moved to billing queue." };
}

export async function bulkApproveOperationalBillingAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = bulkOperationalBillingSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid bulk approve request." };
  }

  const uniqueLines = new Set<string>(parsed.data.line_ids);
  const { supabase } = await requireAuthUser();

  if (parsed.data.deliverable_ids.length > 0) {
    const { data } = await supabase
      .from("assignment_deliverables")
      .select("campaign_line_id")
      .in("id", parsed.data.deliverable_ids);
    for (const row of data ?? []) uniqueLines.add(row.campaign_line_id);
  }
  if (parsed.data.post_ids.length > 0) {
    const { data } = await supabase
      .from("assignment_post_schedule")
      .select("campaign_line_id")
      .in("id", parsed.data.post_ids);
    for (const row of data ?? []) uniqueLines.add(row.campaign_line_id);
  }

  const lineIds = [...uniqueLines];
  if (lineIds.length === 0) {
    return { ok: false, message: "Select at least one assignment to approve." };
  }

  let approved = 0;
  let skipped = 0;

  for (const lineId of lineIds) {
    const fd = new FormData();
    fd.set("line_id", lineId);
    fd.set("campaign_id", parsed.data.campaign_id);
    const result = await approveLineForBillingAction({ ok: false }, fd);
    if (result.ok) approved += 1;
    else skipped += 1;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[bulk-billing] approve", { approved, skipped, lineIds });
  }

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return {
    ok: approved > 0,
    message:
      approved > 0
        ? `Approved ${approved} assignment${approved === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}.`
        : "No draft assignments were approved.",
  };
}

export async function bulkMoveOperationalBillingAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = bulkOperationalBillingSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid bulk move request." };
  }

  const uniqueLines = new Set<string>(parsed.data.line_ids);

  const { supabase } = await requireAuthUser();
  if (parsed.data.deliverable_ids.length > 0) {
    const { data } = await supabase
      .from("assignment_deliverables")
      .select("campaign_line_id")
      .in("id", parsed.data.deliverable_ids);
    for (const row of data ?? []) uniqueLines.add(row.campaign_line_id);
  }
  if (parsed.data.post_ids.length > 0) {
    const { data } = await supabase
      .from("assignment_post_schedule")
      .select("campaign_line_id")
      .in("id", parsed.data.post_ids);
    for (const row of data ?? []) uniqueLines.add(row.campaign_line_id);
  }

  const lineIds = [...uniqueLines];
  if (lineIds.length === 0) {
    return { ok: false, message: "Select at least one assignment to move." };
  }

  let moved = 0;
  let skipped = 0;

  for (const lineId of lineIds) {
    const fd = new FormData();
    fd.set("line_id", lineId);
    fd.set("campaign_id", parsed.data.campaign_id);
    const result = await moveLineToBillingAction({ ok: false }, fd);
    if (result.ok) moved += 1;
    else skipped += 1;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[bulk-billing] move to billing", { moved, skipped, lineIds });
  }

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return {
    ok: moved > 0,
    message:
      moved > 0
        ? `Moved ${moved} assignment${moved === 1 ? "" : "s"} to billing${skipped ? ` (${skipped} skipped)` : ""}.`
        : "No assignments were moved to billing.",
  };
}

export async function createInvoiceFromLinesAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = createInvoiceFromLinesSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const lineIds = (parsed.data.line_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const requestedDeliverableIds = (parsed.data.deliverable_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const requestedPostIds = (parsed.data.post_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .select("id, client_id, currency_code, name")
    .eq("id", parsed.data.campaign_id)
    .maybeSingle();

  if (headerError || !header) {
    return { ok: false, message: headerError?.message ?? "Campaign not found." };
  }

  const { deliverableIds, postIds, error: resolveError } =
    await resolveOperationalInvoiceTargets(supabase, parsed.data.campaign_id, {
      lineIds,
      deliverableIds: requestedDeliverableIds,
      postIds: requestedPostIds,
    });

  if (resolveError) {
    return { ok: false, message: resolveError };
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[billing-invoice] selected operational row ids", {
      lineIds,
      deliverableIds,
      postIds,
      mode: parsed.data.invoice_mode,
    });
  }

  const { deliverables, error: deliverablesError } =
    await fetchDeliverablesForInvoicing(
      supabase,
      parsed.data.campaign_id,
      deliverableIds
    );

  if (deliverablesError) {
    return { ok: false, message: deliverablesError };
  }

  const validationError = validateDeliverablesForInvoice(deliverables);
  if (validationError && postIds.length === 0) {
    return { ok: false, message: validationError };
  }

  let invoiceId: string;
  let invoiceDocumentNumber: string;

  if (parsed.data.invoice_mode === "append") {
    const existingId = parsed.data.existing_invoice_id?.trim();
    if (!existingId) {
      return { ok: false, message: "Select an invoice to append to." };
    }

    const appendCheck = await validateAppendableInvoice(supabase, existingId, {
      campaignId: header.id,
      clientId: header.client_id,
      currency: header.currency_code,
    });

    if (!appendCheck.ok) {
      return { ok: false, message: appendCheck.error };
    }

    invoiceId = appendCheck.invoice.id;
    invoiceDocumentNumber = appendCheck.invoice.document_number;

    if (process.env.NODE_ENV === "development") {
      console.debug("[billing-invoice] append action", { invoiceId, postIds, deliverableIds });
    }
  } else {
    const { countryCode } = await resolveClientBillingVatRate(
      supabase,
      header.client_id
    );

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        client_id: header.client_id,
        campaign_id: header.id,
        campaign_header_id: header.id,
        status: "sent",
        due_date: parsed.data.due_date,
        currency: header.currency_code,
        notes: emptyToNull(parsed.data.notes),
        billing_country_code: countryCode,
        created_by: user.id,
      })
      .select("id, document_number")
      .single();

    if (invoiceError || !invoice) {
      return { ok: false, message: invoiceError?.message ?? "Invoice creation failed." };
    }

    invoiceId = invoice.id;
    invoiceDocumentNumber = invoice.document_number;

    const approvalError = await createFinancialApprovalChain(supabase, user.id, {
      entity_type: "invoice",
      entity_id: invoiceId,
      title: `Invoice ${invoiceDocumentNumber}`,
      description: `Finance approval for ${header.name}`,
      stages: ["finance", "cfo_admin"],
    });

    if (approvalError && process.env.NODE_ENV === "development") {
      console.debug("[billing-invoice] approval chain skipped", approvalError);
    }
  }

  const lockResult = await lockDeliverablesOnInvoice(
    supabase,
    invoiceId,
    header.id,
    deliverables
  );

  if (lockResult.error) {
    if (parsed.data.invoice_mode === "new") {
      await supabase.from("invoices").delete().eq("id", invoiceId);
    }
    return { ok: false, message: lockResult.error };
  }

  revalidateBilling({
    campaignId: parsed.data.campaign_id,
    invoiceId,
  });

  const actionLabel =
    parsed.data.invoice_mode === "append" ? "Appended to" : "Created";

  return {
    ok: true,
    message: `${actionLabel} invoice ${invoiceDocumentNumber} for ${deliverables.length} deliverable(s)${postIds.length ? ` and ${postIds.length} post row(s)` : ""}.`,
    invoiceId,
  };
}

export async function recordCollectionPaymentAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = recordCollectionPaymentSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("id, client_id, campaign_header_id, document_number, currency")
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, message: invError?.message ?? "Invoice not found." };
  }

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoice.id,
    client_id: invoice.client_id,
    amount: parsed.data.amount,
    currency: invoice.currency,
    status: "completed",
    payment_method: parsed.data.payment_method,
    reference_number: emptyToNull(parsed.data.reference_number),
    notes: emptyToNull(parsed.data.notes),
    paid_at: new Date().toISOString(),
    recorded_by: user.id,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await syncDeliverableCollectionsForInvoice(supabase, invoice.id);

  revalidateBilling({
    invoiceId: invoice.id,
    campaignId: invoice.campaign_header_id ?? undefined,
  });

  return {
    ok: true,
    message: `Payment recorded for ${invoice.document_number}.`,
  };
}

export async function recordVendorPaymentAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = recordVendorPaymentSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: assignment, error: assignError } = await supabase
    .from("campaign_influencers")
    .select("id, agreed_fee, currency, campaign_header_id")
    .eq("id", parsed.data.assignment_id)
    .maybeSingle();

  if (assignError || !assignment) {
    return { ok: false, message: assignError?.message ?? "Assignment not found." };
  }

  const { data: batch, error: batchError } = await supabase
    .from("vendor_payment_batches")
    .insert({
      name: parsed.data.batch_name,
      status: "completed",
      total_amount: parsed.data.amount || Number(assignment.agreed_fee),
      currency: assignment.currency,
      notes: emptyToNull(parsed.data.notes),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return { ok: false, message: batchError?.message ?? "Batch creation failed." };
  }

  const { error: updateError } = await supabase
    .from("campaign_influencers")
    .update({
      vendor_payment_status: "paid",
      vendor_paid_at: new Date().toISOString(),
      payment_batch_id: batch.id,
    })
    .eq("id", parsed.data.assignment_id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return { ok: true, message: "Vendor payment recorded in batch." };
}

export async function decideFinancialApprovalAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = decideFinancialApprovalSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { error } = await supabase
    .from("financial_approval_requests")
    .update({
      status: parsed.data.decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_notes: emptyToNull(parsed.data.decision_notes),
    })
    .eq("id", parsed.data.approval_id)
    .in("status", ["pending", "in_review"]);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/billing");
  return { ok: true, message: `Approval ${parsed.data.decision}.` };
}

export async function requestFinanceOverrideAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = requestFinanceOverrideSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const approvalError = await createFinancialApprovalChain(supabase, user.id, {
    entity_type: "campaign_line_override",
    entity_id: parsed.data.line_id,
    title: "Finance override request",
    description: parsed.data.reason,
    stages: ["finance", "cfo_admin"],
  });

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return {
    ok: true,
    message: approvalError
      ? "Finance override request submitted. Approval workflow could not be recorded."
      : "Finance override request submitted.",
  };
}

export async function grantFinanceOverrideAction(
  approvalId: string,
  lineId: string,
  hours: number
): Promise<BillingActionState> {
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const until = new Date(Date.now() + hours * 3600000).toISOString();

  const { error } = await supabase
    .from("campaign_lines")
    .update({ finance_override_until: until })
    .eq("id", lineId);

  if (error) {
    return { ok: false, message: error.message };
  }

  await supabase
    .from("financial_approval_requests")
    .update({
      status: "approved",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", approvalId);

  revalidatePath("/billing");
  return { ok: true, message: "Finance override granted." };
}

export async function closeBillingLineAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = closeBillingLineSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { error } = await supabase
    .from("campaign_lines")
    .update(lineBillingPatch("closed"))
    .eq("id", parsed.data.line_id)
    .eq("campaign_header_id", parsed.data.campaign_id)
    .in("billing_status", ["paid", "partially_paid"]);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return { ok: true, message: "Billing line closed." };
}

export async function ungenerateInvoiceAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = ungenerateInvoiceSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Reason is required (min 3 characters)." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const auth = await requirePermission(supabase, "finance.regenerate");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, client_id, total, subtotal, tax_amount, version_number, regeneration_status"
    )
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, message: invError?.message ?? "Invoice not found." };
  }

  if (invoice.regeneration_status === "pending_regeneration") {
    return { ok: false, message: "Invoice is already pending regeneration." };
  }

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoice.id)
    .order("sort_order");

  await governanceDb(supabase).from("invoice_versions").insert({
    invoice_id: invoice.id,
    version_number: invoice.version_number ?? 1,
    snapshot: invoice as Record<string, unknown>,
    line_items_snapshot: lineItems ?? [],
    total: Number(invoice.total ?? 0),
    subtotal: Number(invoice.subtotal ?? 0),
    tax_amount: Number(invoice.tax_amount ?? 0),
    regeneration_reason: parsed.data.reason,
    regenerated_by: auth.userId,
  });

  const { data: linkedLines } = await supabase
    .from("campaign_lines")
    .select("id, billing_status")
    .eq("invoice_id", invoice.id);

  const lineIdsFromInvoice = (linkedLines ?? []).map((l) => (l as { id: string }).id);
  const unlockedLineIds = await unlockDeliverablesForInvoice(supabase, invoice.id);
  const affectedLineIds = [...new Set([...lineIdsFromInvoice, ...unlockedLineIds])];

  if (affectedLineIds.length > 0) {
    const overrideUntil = new Date(Date.now() + 72 * 3600000).toISOString();

    for (const lineId of affectedLineIds) {
      const linked = linkedLines?.find((l) => (l as { id: string }).id === lineId) as
        | { id: string; billing_status: string }
        | undefined;

      await syncLineBillingFromDeliverables(
        supabase,
        lineId,
        linked?.billing_status ?? "moved_to_billing"
      );

      const { data: lineDeliverables } = await supabase
        .from("assignment_deliverables")
        .select("locked_at")
        .eq("campaign_line_id", lineId);

      const anyLocked = (lineDeliverables ?? []).some((d) => d.locked_at);
      const allLocked =
        (lineDeliverables ?? []).length > 0 &&
        (lineDeliverables ?? []).every((d) => d.locked_at);

      await supabase
        .from("campaign_lines")
        .update({
          revenue_locked: allLocked,
          cost_locked: allLocked,
          vendor_assignment_locked: allLocked,
          vat_locked: anyLocked,
          finance_override_until: overrideUntil,
          invoice_id: null,
        })
        .eq("id", lineId);
    }
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      regeneration_status: "pending_regeneration",
      ungenerated_at: new Date().toISOString(),
      ungenerated_by: auth.userId,
      ungenerate_reason: parsed.data.reason,
    })
    .eq("id", invoice.id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  await governanceDb(supabase).from("finance_override_logs").insert({
    entity_type: "invoice",
    entity_id: invoice.id,
    override_type: "ungenerate",
    reason: parsed.data.reason,
    granted_by: auth.userId,
    granted_until: new Date(Date.now() + 72 * 3600000).toISOString(),
  });

  revalidateBilling({
    invoiceId: invoice.id,
    campaignId: invoice.campaign_header_id ?? undefined,
  });

  return {
    ok: true,
    message: `Invoice ${invoice.document_number} un-generated. Same number reserved — status: Pending Regeneration.`,
  };
}

export async function regenerateInvoiceAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const parsed = regenerateInvoiceSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Reason is required (min 3 characters)." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const auth = await requirePermission(supabase, "finance.regenerate");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(
      "id, document_number, campaign_header_id, version_number, regeneration_status"
    )
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, message: invError?.message ?? "Invoice not found." };
  }

  if (invoice.regeneration_status !== "pending_regeneration") {
    return {
      ok: false,
      message: "Only invoices pending regeneration can be regenerated.",
    };
  }

  const { data: linkedLines, error: linesError } = await supabase
    .from("campaign_lines")
    .select(
      "id, document_number, name, revenue, revenue_before_vat, revenue_vat_percent, revenue_vat_exempt"
    )
    .eq("invoice_id", invoice.id);

  if (linesError) {
    return { ok: false, message: linesError.message };
  }

  const deliverableRegen = await regenerateInvoiceFromDeliverables(
    supabase,
    invoice.id,
    invoice.campaign_header_id!
  );

  if (deliverableRegen.error) {
    return { ok: false, message: deliverableRegen.error };
  }

  const lines = linkedLines ?? [];

  if (!deliverableRegen.usedDeliverables && lines.length > 0) {
    let sortOrder = 0;
    for (const line of lines) {
      sortOrder += 1;
      await supabase.from("invoice_line_items").insert(
        invoiceLinePayload(
          invoice.id,
          invoice.campaign_header_id!,
          line as CampaignLineForInvoice,
          sortOrder
        )
      );
    }
  }

  const { data: refreshedInvoice, error: refreshError } = await supabase
    .from("invoices")
    .select("subtotal, tax_amount, total")
    .eq("id", invoice.id)
    .single();

  if (refreshError || !refreshedInvoice) {
    return { ok: false, message: refreshError?.message ?? "Failed to refresh invoice totals." };
  }

  const subtotal = Number(refreshedInvoice.subtotal);
  const taxAmount = Number(refreshedInvoice.tax_amount);
  const total = Number(refreshedInvoice.total);
  const newVersion = (invoice.version_number ?? 1) + 1;

  const { error: invoiceUpdateError } = await supabase
    .from("invoices")
    .update({
      version_number: newVersion,
      regeneration_status: "regenerated",
      status: "sent",
    })
    .eq("id", invoice.id);

  if (invoiceUpdateError) {
    return { ok: false, message: invoiceUpdateError.message };
  }

  const lineIds = lines.map((l) => (l as { id: string }).id);
  if (lineIds.length > 0) {
    const now = new Date().toISOString();
    await supabase
      .from("campaign_lines")
      .update({
        ...lineBillingPatch("invoiced"),
        revenue_locked: true,
        cost_locked: true,
        vendor_assignment_locked: true,
        vat_locked: true,
        finance_override_until: null,
        billing_invoiced_at: now,
      })
      .in("id", lineIds);
  }

  await governanceDb(supabase).from("invoice_versions").insert({
    invoice_id: invoice.id,
    version_number: newVersion,
    snapshot: { total, subtotal, tax_amount: taxAmount },
    line_items_snapshot: lines,
    total,
    subtotal,
    tax_amount: taxAmount,
    regeneration_reason: parsed.data.reason,
    regenerated_by: auth.userId,
  });

  revalidateBilling({
    invoiceId: invoice.id,
    campaignId: invoice.campaign_header_id ?? undefined,
  });

  return {
    ok: true,
    message: `Invoice ${invoice.document_number} regenerated (v${newVersion}). Same invoice number preserved.`,
  };
}

export async function loadCampaignBillingDetailAction(campaignId: string) {
  try {
    const detail = await getCampaignOperationalBillingDetail(campaignId);
    if (process.env.NODE_ENV === "development" && detail) {
      console.debug("[billing-drilldown] expansion loaded", {
        campaignId,
        rows: detail.operational_rows.length,
      });
    }
    return { ok: true as const, detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load drill-down.";
    return { ok: false as const, message };
  }
}
