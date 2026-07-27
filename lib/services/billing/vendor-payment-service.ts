import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import {
  computePaymentReadiness,
  resolvePaymentBankAccount,
} from "@/lib/creators/crm/payment-readiness";
import { logVendorPaymentTimelineEvent } from "@/lib/creators/crm/payment-timeline";
import type { recordVendorPaymentSchema } from "@/lib/domains/billing/schemas";
import { emptyToNull, type BillingMutationResult } from "./billing-helpers";

export async function recordVendorPayment(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof recordVendorPaymentSchema>
): Promise<BillingMutationResult> {
  const { data: assignment, error: assignError } = await supabase
    .from("campaign_influencers")
    .select("id, agreed_fee, currency, campaign_header_id, influencer_id")
    .eq("id", input.assignment_id)
    .maybeSingle();

  if (assignError || !assignment) {
    return { ok: false, message: assignError?.message ?? "Assignment not found." };
  }

  const influencerId = (assignment as { influencer_id?: string }).influencer_id;
  if (!influencerId) {
    return { ok: false, message: "Assignment has no creator." };
  }

  const [{ data: banks }, { data: influencer }, { data: documents }] =
    await Promise.all([
      supabase
        .from("influencer_bank_accounts")
        .select("*")
        .eq("influencer_id", influencerId),
      supabase
        .from("influencers")
        .select("payment_details")
        .eq("id", influencerId)
        .maybeSingle(),
      supabase
        .from("influencer_documents")
        .select("document_type")
        .eq("influencer_id", influencerId),
    ]);

  const bank = resolvePaymentBankAccount(
    (banks ?? []) as Array<Record<string, unknown> & { id?: string }>,
    ((influencer as { payment_details?: Record<string, unknown> } | null)
      ?.payment_details ?? null) as Record<string, unknown> | null
  );
  const readiness = computePaymentReadiness({
    bank,
    documentTypes: (documents ?? []).map(
      (d) => (d as { document_type: string }).document_type
    ),
  });

  if (!readiness.ready) {
    return {
      ok: false,
      message: `Payment not ready. Missing: ${readiness.missing
        .map((m) => m.label)
        .join(", ")}.`,
    };
  }

  const { data: batch, error: batchError } = await supabase
    .from("vendor_payment_batches")
    .insert({
      name: input.batch_name,
      status: "completed",
      total_amount: input.amount || Number(assignment.agreed_fee),
      currency: assignment.currency,
      notes: emptyToNull(input.notes),
      created_by: userId,
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
    .eq("id", input.assignment_id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  await logVendorPaymentTimelineEvent(supabase, {
    influencerId,
    assignmentId: input.assignment_id,
    eventType: "payment_completed",
    summary: "Payment completed",
    actorId: userId,
    metadata: {
      batch_id: batch.id,
      amount: input.amount || Number(assignment.agreed_fee),
      bank_account_id: readiness.bankAccountId,
    },
  });

  return { ok: true, message: "Vendor payment recorded in batch." };
}
