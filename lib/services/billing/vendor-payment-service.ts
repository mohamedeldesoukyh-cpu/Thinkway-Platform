import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { recordVendorPaymentSchema } from "@/features/billing/schemas";
import { emptyToNull, type BillingMutationResult } from "./billing-helpers";

export async function recordVendorPayment(supabase: SupabaseClient, userId: string, input: z.infer<typeof recordVendorPaymentSchema>): Promise<BillingMutationResult> {const { data: assignment, error: assignError } = await supabase
    .from("campaign_influencers")
    .select("id, agreed_fee, currency, campaign_header_id")
    .eq("id", input.assignment_id)
    .maybeSingle();

  if (assignError || !assignment) {
    return { ok: false, message: assignError?.message ?? "Assignment not found." };
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

  return { ok: true, message: "Vendor payment recorded in batch." };

}
