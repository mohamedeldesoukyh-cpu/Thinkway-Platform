import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { decideFinancialApprovalSchema, requestFinanceOverrideSchema } from "@/lib/domains/billing/schemas";
import { emptyToNull, type BillingMutationResult } from "./billing-helpers";
import { insertFinancialApprovalChain } from "./repositories/billing-repository";

export async function decideFinancialApproval(supabase: SupabaseClient, userId: string, input: z.infer<typeof decideFinancialApprovalSchema>): Promise<BillingMutationResult> {const { error } = await supabase
    .from("financial_approval_requests")
    .update({
      status: input.decision,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      decision_notes: emptyToNull(input.decision_notes),
    })
    .eq("id", input.approval_id)
    .in("status", ["pending", "in_review"]);

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, message: `Approval ${input.decision}.` };

}

export async function requestFinanceOverride(supabase: SupabaseClient, userId: string, input: z.infer<typeof requestFinanceOverrideSchema>): Promise<BillingMutationResult> {const approvalError = await insertFinancialApprovalChain(supabase, userId, {
    entity_type: "campaign_line_override",
    entity_id: input.line_id,
    title: "Finance override request",
    description: input.reason,
    stages: ["finance", "cfo_admin"],
  });

  return {
    ok: true,
    message: approvalError
      ? "Finance override request submitted. Approval workflow could not be recorded."
      : "Finance override request submitted.",
  };

}

export async function grantFinanceOverride(supabase: SupabaseClient, userId: string, input: { approval_id: string; line_id: string; hours: number }): Promise<BillingMutationResult> {const until = new Date(Date.now() + input.hours * 3600000).toISOString();

  const { error } = await supabase
    .from("campaign_lines")
    .update({ finance_override_until: until })
    .eq("id", input.line_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  await supabase
    .from("financial_approval_requests")
    .update({
      status: "approved",
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", input.approval_id);

  return { ok: true, message: "Finance override granted." };

}