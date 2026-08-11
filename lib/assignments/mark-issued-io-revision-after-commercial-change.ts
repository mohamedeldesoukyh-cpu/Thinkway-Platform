import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentCommercialMastersChanged } from "@/lib/assignments/assignment-commercial-masters";
import { hasActiveFinanceOverride } from "@/lib/campaigns/finance-override";

type LineCommercialGateRow = {
  campaign_header_id: string;
  revenue?: number | null;
  cost?: number | null;
  revenue_before_vat?: number | null;
  cost_before_vat?: number | null;
  agency_fee_percent?: number | null;
  usage_rights_amount?: number | null;
  usage_rights_cost?: number | null;
  vendor_io_id?: string | null;
  invoice_id?: string | null;
  finance_override_until?: string | null;
};

/**
 * After deliverable/hierarchy commercial edits, mark issued CIO/VIO as
 * Revision Required when Rev / Cost / AF% / UR masters changed.
 */
export async function markIssuedIoRevisionAfterAssignmentCommercialChange(
  supabase: SupabaseClient,
  input: {
    lineId: string;
    before: LineCommercialGateRow;
    actorId?: string | null;
  }
): Promise<{ marked: boolean; message?: string }> {
  const { data: afterRaw, error } = await supabase
    .from("campaign_lines")
    .select(
      "campaign_header_id, revenue, cost, revenue_before_vat, cost_before_vat, agency_fee_percent, usage_rights_amount, usage_rights_cost, vendor_io_id, invoice_id, finance_override_until"
    )
    .eq("id", input.lineId)
    .maybeSingle();

  if (error || !afterRaw) {
    return { marked: false, message: error?.message };
  }

  const after = afterRaw as LineCommercialGateRow;
  const commercialChanged = assignmentCommercialMastersChanged(input.before, after);
  if (!commercialChanged) {
    return { marked: false };
  }

  const financeOverrideActive = hasActiveFinanceOverride(after.finance_override_until);
  const { data: issuedClientIos } = await supabase
    .from("client_ios")
    .select("id, status, sent_at")
    .eq("campaign_header_id", after.campaign_header_id)
    .eq("is_superseded", false)
    .in("status", ["sent", "under_client_review", "approved", "rejected"]);

  const hasIssuedClientIo = (issuedClientIos ?? []).length > 0;
  const vendorIoRevisionAllowed = !after.invoice_id || financeOverrideActive;
  const shouldMark = Boolean(
    (after.vendor_io_id &&
      vendorIoRevisionAllowed &&
      (financeOverrideActive || !after.invoice_id)) ||
      hasIssuedClientIo
  );

  if (!shouldMark) {
    return { marked: false };
  }

  const costChanged =
    Math.abs(
      Number(after.cost_before_vat ?? after.cost ?? 0) -
        Number(input.before.cost_before_vat ?? input.before.cost ?? 0)
    ) > 0.009;
  const reasonCode = costChanged
    ? ("creator_price_changed" as const)
    : ("commercial_correction" as const);
  const reasonDetail = costChanged
    ? "Creator price changed after document issuance."
    : "Commercial correction (client amount / fees / usage rights) after document issuance.";

  const { applyBusinessChangeImpact } = await import("@/lib/change-impact/apply");
  const impactResult = await applyBusinessChangeImpact(supabase, {
    eventType: costChanged
      ? "creator_price_updated"
      : "manual_mark_revision_required",
    reasonCode,
    reasonDetail,
    campaignHeaderId: after.campaign_header_id,
    entityType: "campaign_line",
    entityId: input.lineId,
    actorId: input.actorId ?? undefined,
    vendorIoIds: after.vendor_io_id ? [after.vendor_io_id] : undefined,
    campaignLineIds: [input.lineId],
    estimatedImpact: {
      amountDelta:
        Number(after.cost_before_vat ?? after.cost ?? 0) -
        Number(input.before.cost_before_vat ?? input.before.cost ?? 0),
      note: reasonDetail,
    },
    payload: {
      line_id: input.lineId,
      vendor_io_id: after.vendor_io_id,
      source: "assignment_deliverable_commercial_edit",
    },
  });

  if (!impactResult.ok) {
    return { marked: false, message: impactResult.error };
  }

  if (impactResult.assessment.lifecycleReactions.length > 0) {
    const { unlockCampaignLineFinanceFields } = await import(
      "@/lib/services/campaigns/repositories/campaign-repository"
    );
    await unlockCampaignLineFinanceFields(supabase, input.lineId);
    return { marked: true };
  }

  return { marked: false };
}

export async function loadLineCommercialGateSnapshot(
  supabase: SupabaseClient,
  lineId: string
): Promise<LineCommercialGateRow | null> {
  const { data } = await supabase
    .from("campaign_lines")
    .select(
      "campaign_header_id, revenue, cost, revenue_before_vat, cost_before_vat, agency_fee_percent, usage_rights_amount, usage_rights_cost, vendor_io_id, invoice_id, finance_override_until"
    )
    .eq("id", lineId)
    .maybeSingle();
  return (data as LineCommercialGateRow | null) ?? null;
}
