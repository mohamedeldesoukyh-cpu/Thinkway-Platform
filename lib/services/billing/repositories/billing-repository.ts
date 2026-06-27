import type { SupabaseClient } from "@supabase/supabase-js";

import { FINANCIAL_APPROVAL_CHAIN } from "@/lib/domains/billing/constants";
import { lineBillingPatch } from "../billing-helpers";

export async function fetchLineForBillingApproval(
  supabase: SupabaseClient,
  lineId: string,
  campaignId: string
) {
  return supabase
    .from("campaign_lines")
    .select("billing_status, document_number")
    .eq("id", lineId)
    .eq("campaign_header_id", campaignId)
    .maybeSingle();
}

export async function updateLineBillingStatus(
  supabase: SupabaseClient,
  lineId: string,
  billingStatus: string
) {
  return supabase.from("campaign_lines").update({ billing_status: billingStatus }).eq("id", lineId);
}

export async function fetchLineWithHeaderForMove(
  supabase: SupabaseClient,
  lineId: string,
  campaignId: string
) {
  return Promise.all([
    supabase
      .from("campaign_lines")
      .select(
        "id, billing_status, document_number, po_amount, cost, revenue_before_vat, revenue, revenue_vat_percent, revenue_vat_amount, revenue_after_vat, revenue_vat_exempt, cost_before_vat, cost_vat_percent, cost_vat_amount, cost_after_vat, cost_vat_exempt, platform, campaign_header_id"
      )
      .eq("id", lineId)
      .eq("campaign_header_id", campaignId)
      .maybeSingle(),
    supabase
      .from("campaign_headers")
      .select(
        "po_amount_campaign_currency, po_consumed_amount, po_remaining_amount, po_remaining_percent, po_status, po_expiry_date, po_override_approved"
      )
      .eq("id", campaignId)
      .maybeSingle(),
  ] as const);
}

export async function fetchSiblingLinesForPo(
  supabase: SupabaseClient,
  campaignId: string
) {
  return supabase
    .from("campaign_lines")
    .select(
      "po_amount, revenue_before_vat, revenue, usage_rights_amount, agency_fee_percent, agency_fee_amount"
    )
    .eq("campaign_header_id", campaignId);
}

export async function moveLineToBillingQueue(
  supabase: SupabaseClient,
  lineId: string,
  previousStatus: string
) {
  const { error } = await supabase
    .from("campaign_lines")
    .update({
      billing_status: "moved_to_billing",
      billing_moved_at: new Date().toISOString(),
    })
    .eq("id", lineId);
  if (error) return { error: error.message };
  return { error: null as string | null, previousStatus };
}

export async function revertLineBillingStatus(
  supabase: SupabaseClient,
  lineId: string,
  billingStatus: string
) {
  return supabase.from("campaign_lines").update({ billing_status: billingStatus }).eq("id", lineId);
}

export async function closeBillingLine(
  supabase: SupabaseClient,
  lineId: string,
  campaignId: string
) {
  return supabase
    .from("campaign_lines")
    .update(lineBillingPatch("closed"))
    .eq("id", lineId)
    .eq("campaign_header_id", campaignId)
    .in("billing_status", ["paid", "partially_paid"]);
}

export async function grantLineFinanceOverride(
  supabase: SupabaseClient,
  lineId: string,
  until: string
) {
  return supabase
    .from("campaign_lines")
    .update({ finance_override_until: until })
    .eq("id", lineId);
}

export type FinancialApprovalChainInput = {
  entity_type: string;
  entity_id: string;
  title: string;
  description?: string;
  stages?: typeof FINANCIAL_APPROVAL_CHAIN;
};

export async function insertFinancialApprovalChain(
  supabase: SupabaseClient,
  userId: string,
  input: FinancialApprovalChainInput
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

export async function decideFinancialApproval(
  supabase: SupabaseClient,
  userId: string,
  input: {
    approval_id: string;
    decision: string;
    decision_notes?: string | null;
  }
) {
  return supabase
    .from("financial_approval_requests")
    .update({
      status: input.decision,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      decision_notes: input.decision_notes ?? null,
    })
    .eq("id", input.approval_id)
    .in("status", ["pending", "in_review"]);
}

export async function approveFinancialRequest(
  supabase: SupabaseClient,
  userId: string,
  approvalId: string
) {
  return supabase
    .from("financial_approval_requests")
    .update({
      status: "approved",
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", approvalId);
}
