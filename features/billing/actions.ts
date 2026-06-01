"use server";

import { revalidatePath } from "next/cache";

import { FINANCIAL_APPROVAL_CHAIN } from "@/features/billing/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  approveLineForBillingSchema,
  closeBillingLineSchema,
  createInvoiceFromLinesSchema,
  decideFinancialApprovalSchema,
  moveLineToBillingSchema,
  recordCollectionPaymentSchema,
  recordVendorPaymentSchema,
  requestFinanceOverrideSchema,
} from "./schemas";

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
) {
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
      status: i === 0 ? "pending" : "pending",
    });
    if (error) {
      throw new Error(error.message);
    }
  }
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

  await createFinancialApprovalChain(supabase, user.id, {
    entity_type: "campaign_line",
    entity_id: parsed.data.line_id,
    title: `Billing approval — ${line.document_number}`,
    description: "Campaign Manager approval for billing readiness",
    stages: ["campaign_manager"],
  });

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return { ok: true, message: "Line approved for billing." };
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

  const { data: line, error: fetchError } = await supabase
    .from("campaign_lines")
    .select("billing_status, document_number, po_amount, cost")
    .eq("id", parsed.data.line_id)
    .eq("campaign_header_id", parsed.data.campaign_id)
    .maybeSingle();

  if (fetchError || !line) {
    return { ok: false, message: fetchError?.message ?? "Line not found." };
  }

  if (!["approved", "draft"].includes(line.billing_status)) {
    return {
      ok: false,
      message: "Line must be approved before moving to billing.",
    };
  }

  if (Number(line.cost) > Number(line.po_amount) && Number(line.po_amount) > 0) {
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

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return { ok: true, message: "Line moved to billing queue." };
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

  const lineIds = parsed.data.line_ids
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (lineIds.length === 0) {
    return { ok: false, message: "Select at least one campaign line." };
  }

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

  const { data: lines, error: linesError } = await supabase
    .from("campaign_lines")
    .select("id, document_number, name, revenue, billing_status, invoice_id")
    .eq("campaign_header_id", parsed.data.campaign_id)
    .in("id", lineIds);

  if (linesError || !lines?.length) {
    return { ok: false, message: linesError?.message ?? "Lines not found." };
  }

  const invalid = lines.filter(
    (l) =>
      !["moved_to_billing", "approved"].includes(l.billing_status) || l.invoice_id
  );
  if (invalid.length > 0) {
    return {
      ok: false,
      message: "All selected lines must be in billing queue and not already invoiced.",
    };
  }

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
      created_by: user.id,
    })
    .select("id, document_number")
    .single();

  if (invoiceError || !invoice) {
    return { ok: false, message: invoiceError?.message ?? "Invoice creation failed." };
  }

  let sortOrder = 0;
  for (const line of lines) {
    sortOrder += 1;
    const { error: itemError } = await supabase.from("invoice_line_items").insert({
      invoice_id: invoice.id,
      campaign_line_id: line.id,
      campaign_header_id: header.id,
      campaign_id: header.id,
      sort_order: sortOrder,
      description: `${line.document_number} — ${line.name}`,
      quantity: 1,
      unit_price: Number(line.revenue),
    });

    if (itemError) {
      await supabase.from("invoices").delete().eq("id", invoice.id);
      return { ok: false, message: itemError.message };
    }
  }

  const now = new Date().toISOString();
  const { error: lockError } = await supabase
    .from("campaign_lines")
    .update({
      billing_status: "invoiced",
      invoice_id: invoice.id,
      revenue_locked: true,
      cost_locked: true,
      vendor_assignment_locked: true,
      billing_invoiced_at: now,
    })
    .in("id", lineIds);

  if (lockError) {
    return { ok: false, message: lockError.message };
  }

  await createFinancialApprovalChain(supabase, user.id, {
    entity_type: "invoice",
    entity_id: invoice.id,
    title: `Invoice ${invoice.document_number}`,
    description: `Finance approval for ${header.name}`,
    stages: ["finance", "cfo_admin"],
  });

  revalidateBilling({
    campaignId: parsed.data.campaign_id,
    invoiceId: invoice.id,
  });

  return {
    ok: true,
    message: `Invoice ${invoice.document_number} created and lines locked.`,
    invoiceId: invoice.id,
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

  await createFinancialApprovalChain(supabase, user.id, {
    entity_type: "campaign_line_override",
    entity_id: parsed.data.line_id,
    title: "Finance override request",
    description: parsed.data.reason,
    stages: ["finance", "cfo_admin"],
  });

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return { ok: true, message: "Finance override request submitted." };
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
    .update({ billing_status: "closed" })
    .eq("id", parsed.data.line_id)
    .eq("campaign_header_id", parsed.data.campaign_id)
    .in("billing_status", ["paid", "partially_paid"]);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateBilling({ campaignId: parsed.data.campaign_id });
  return { ok: true, message: "Billing line closed." };
}
