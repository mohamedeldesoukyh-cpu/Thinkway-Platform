"use server";

import { revalidatePath } from "next/cache";

import { recordCollectionPaymentSchema } from "@/features/billing/schemas";
import { requirePermission } from "@/lib/auth/permissions";
import { buildAllocationPlan } from "@/lib/collections/payment-allocation";
import { syncDeliverableCollectionsForInvoice } from "@/lib/billing/sync-deliverable-collections";
import { planningDb } from "@/lib/supabase/governance-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { devLog } from "@/lib/platform/logger";

const COLLECTIONS_PATH = "/collections";
const TREASURY_PATH = "/treasury";

function emptyToNull(value: string | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

async function logCollectionAudit(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    metadata?: Record<string, unknown>;
  }
) {
  await planningDb(supabase)
    .from("collection_audit_logs")
    .insert({
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      actor_id: input.userId,
      metadata: input.metadata ?? {},
    } as never);
}

export type CollectionsActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function allocatePaymentsAction(input: {
  paymentAmount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  paidAt?: string;
  allocations: { invoiceId: string; amount: number }[];
}): Promise<CollectionsActionResult> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "collections.write");
  if ("error" in auth) return { ok: false, error: auth.error };

  if (input.allocations.length === 0) {
    return { ok: false, error: "Select at least one invoice." };
  }

  const invoiceIds = input.allocations.map((a) => a.invoiceId);
  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select("id, document_number, total, amount_paid, currency, client_id")
    .in("id", invoiceIds);

  if (invError || !invoices?.length) {
    return { ok: false, error: invError?.message ?? "Invoices not found." };
  }

  const plan = buildAllocationPlan(
    input.paymentAmount,
    invoices.map((inv) => {
      const row = inv as {
        id: string;
        total: number;
        amount_paid: number;
        document_number: string;
      };
      const requested =
        input.allocations.find((a) => a.invoiceId === row.id)?.amount ?? 0;
      return {
        invoice_id: row.id,
        document_number: row.document_number,
        total: Number(row.total),
        amount_paid: Number(row.amount_paid),
        requested_amount: requested,
      };
    })
  );

  if (!plan.ok) {
    return { ok: false, error: plan.error };
  }

  for (const line of plan.lines) {
    const inv = invoices.find((i) => (i as { id: string }).id === line.invoice_id) as {
      id: string;
      client_id: string;
      currency: string;
    };

    const { data: payment, error: payError } = await supabase
      .from("payments")
      .insert({
        invoice_id: inv.id,
        client_id: inv.client_id,
        amount: line.allocated_amount,
        currency: inv.currency,
        status: "completed",
        payment_method: input.paymentMethod,
        reference_number: emptyToNull(input.referenceNumber),
        notes: emptyToNull(input.notes),
        paid_at: input.paidAt ?? new Date().toISOString(),
        recorded_by: auth.userId,
      } as never)
      .select("id")
      .single();

    if (payError || !payment) {
      return { ok: false, error: payError?.message ?? "Payment insert failed." };
    }

    await planningDb(supabase)
      .from("payment_allocations")
      .insert({
        payment_id: (payment as { id: string }).id,
        invoice_id: line.invoice_id,
        allocated_amount: line.allocated_amount,
        currency_code: inv.currency,
        notes: input.notes ?? null,
      } as never);

    await syncDeliverableCollectionsForInvoice(supabase, line.invoice_id);
  }

  await logCollectionAudit(supabase, {
    action: "payment_allocated",
    entityType: "collection_batch",
    entityId: invoiceIds[0],
    userId: auth.userId,
    metadata: { lines: plan.lines.length, remainder: plan.remainder },
  });

  revalidatePath(COLLECTIONS_PATH);
  revalidatePath(TREASURY_PATH);
  revalidatePath("/billing");
  devLog("[payment-allocation] applied", { lines: plan.lines.length });

  return {
    ok: true,
    message: `Allocated ${plan.total_allocated} across ${plan.lines.length} invoice(s).`,
  };
}

export async function updateInvoiceCollectionStatusAction(input: {
  invoiceId: string;
  collectionStatus: string;
  notes?: string;
}): Promise<CollectionsActionResult> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "collections.write");
  if ("error" in auth) return { ok: false, error: auth.error };

  const { error } = await supabase
    .from("invoices")
    .update({
      collection_status: input.collectionStatus,
      notes: input.notes?.trim() ?? undefined,
    } as never)
    .eq("id", input.invoiceId);

  if (error) return { ok: false, error: error.message };

  await logCollectionAudit(supabase, {
    action: "collection_status_updated",
    entityType: "invoice",
    entityId: input.invoiceId,
    userId: auth.userId,
    metadata: { status: input.collectionStatus },
  });

  revalidatePath(COLLECTIONS_PATH);
  revalidatePath(`/billing/invoices/${input.invoiceId}`);
  return { ok: true };
}

export async function recordCollectionPaymentFromWorkspaceAction(
  formData: FormData
): Promise<CollectionsActionResult> {
  const parsed = recordCollectionPaymentSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, error: "Invalid payment data." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "collections.write");
  if ("error" in auth) return { ok: false, error: auth.error };

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("id, client_id, currency, document_number")
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();

  if (invError || !invoice) {
    return { ok: false, error: invError?.message ?? "Invoice not found." };
  }

  const inv = invoice as {
    id: string;
    client_id: string;
    currency: string;
    document_number: string;
  };

  const paidAt = new Date().toISOString();

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      invoice_id: inv.id,
      client_id: inv.client_id,
      amount: parsed.data.amount,
      currency: inv.currency,
      status: "completed",
      payment_method: parsed.data.payment_method,
      reference_number: emptyToNull(parsed.data.reference_number),
      notes: emptyToNull(parsed.data.notes),
      paid_at: paidAt,
      recorded_by: auth.userId,
      metadata: {},
    } as never)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (payment) {
    await planningDb(supabase)
      .from("payment_allocations")
      .insert({
        payment_id: (payment as { id: string }).id,
        invoice_id: inv.id,
        allocated_amount: parsed.data.amount,
        currency_code: inv.currency,
      } as never);
  }

  await syncDeliverableCollectionsForInvoice(supabase, inv.id);
  await logCollectionAudit(supabase, {
    action: "payment_recorded",
    entityType: "invoice",
    entityId: inv.id,
    userId: auth.userId,
    metadata: { amount: parsed.data.amount },
  });

  revalidatePath(COLLECTIONS_PATH);
  revalidatePath("/billing");
  devLog("[collections] payment recorded", inv.document_number);

  return { ok: true, message: `Payment recorded for ${inv.document_number}.` };
}
