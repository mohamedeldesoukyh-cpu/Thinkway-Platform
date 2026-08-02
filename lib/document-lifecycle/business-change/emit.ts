import type { SupabaseClient } from "@supabase/supabase-js";

import { isVendorIoIssued } from "@/lib/document-lifecycle/policies/vendor-io";
import type {
  BusinessChangeEventType,
  DocumentLifecycleReasonCode,
  PlannedDocumentReaction,
} from "@/lib/document-lifecycle/types";

export type EmitBusinessChangeInput = {
  eventType: BusinessChangeEventType;
  reasonCode: DocumentLifecycleReasonCode;
  reasonDetail: string;
  campaignHeaderId: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  payload?: Record<string, unknown>;
  vendorIoIds?: string[];
  influencerId?: string | null;
  campaignLineIds?: string[];
  estimatedImpact?: {
    amountDelta?: number | null;
    currencyCode?: string | null;
    note?: string | null;
  };
};

export type EmitBusinessChangeResult =
  | {
      ok: true;
      eventId: string;
      reactions: PlannedDocumentReaction[];
    }
  | { ok: false; error: string };

/**
 * Plan document state transitions only.
 * Change Impact Engine owns interpretation / severity / recommendations.
 */
export async function planDocumentLifecycleReactions(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
): Promise<PlannedDocumentReaction[]> {
  if (input.eventType === "campaign_cancelled") {
    return [
      ...(await planCampaignCancelVendorIoReactions(supabase, input)),
      ...(await planCampaignCancelClientIoReactions(supabase, input)),
    ];
  }
  if (
    input.eventType === "creator_removed" ||
    input.eventType === "creator_replaced"
  ) {
    return planCreatorRemovedVendorIoReactions(supabase, input);
  }
  return [
    ...(await planRevisionRequiredVendorIoReactions(supabase, input)),
    ...(await planRevisionRequiredClientIoReactions(supabase, input)),
  ];
}

/**
 * Apply planned document transitions + reaction audit rows.
 * Does not interpret business impact — Document Lifecycle only.
 */
export async function applyDocumentLifecycleReactions(
  supabase: SupabaseClient,
  input: {
    eventId: string;
    actorId?: string | null;
    estimatedImpact?: EmitBusinessChangeInput["estimatedImpact"];
    reactions: PlannedDocumentReaction[];
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();

  for (const reaction of input.reactions) {
    const table =
      reaction.documentType === "vendor_io"
        ? "vendor_ios"
        : reaction.documentType === "client_io"
          ? "client_ios"
          : null;
    if (!table) continue;

    const { error: updateError } = await supabase
      .from(table)
      .update({
        status: reaction.toStatus,
        lifecycle_reason_code: reaction.reasonCode,
        lifecycle_reason_detail: reaction.reasonDetail,
        lifecycle_changed_at: now,
        lifecycle_changed_by: input.actorId ?? null,
        updated_at: now,
      } as never)
      .eq("id", reaction.documentId)
      .eq("is_superseded", false);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    const aiContext = {
      ...(reaction.aiContext ?? {}),
      estimated_impact: input.estimatedImpact ?? null,
      detection_summary: reaction.reasonDetail,
      recommend_regenerate: reaction.toStatus === "revision_required",
    };

    await supabase.from("document_lifecycle_reactions").insert({
      business_change_event_id: input.eventId,
      document_type: reaction.documentType,
      document_id: reaction.documentId,
      from_status: reaction.fromStatus,
      to_status: reaction.toStatus,
      reason_code: reaction.reasonCode,
      reason_detail: reaction.reasonDetail,
      recommended_actions: reaction.recommendedActions,
      ai_context: aiContext,
    } as never);
  }

  return { ok: true };
}

/**
 * Compatibility shim — NOT a second impact engine.
 * Every business change must enter through Change Impact (`applyBusinessChangeImpact`).
 */
export async function emitBusinessChangeEvent(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
): Promise<EmitBusinessChangeResult> {
  const { applyBusinessChangeImpact } = await import("@/lib/change-impact/apply");
  const result = await applyBusinessChangeImpact(supabase, input);
  if (!result.ok) return result;
  return {
    ok: true,
    eventId: result.eventId,
    reactions: result.assessment.lifecycleReactions,
  };
}

async function loadCampaignVendorIos(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
) {
  let query = supabase
    .from("vendor_ios")
    .select(
      "id, status, sent_at, delivery_status, delivery_method, is_superseded, influencer_id, amount, currency_code, document_number"
    )
    .eq("campaign_header_id", input.campaignHeaderId)
    .eq("is_superseded", false);

  if (input.vendorIoIds?.length) {
    query = query.in("id", input.vendorIoIds);
  }
  if (input.influencerId) {
    query = query.eq("influencer_id", input.influencerId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    status: string;
    sent_at: string | null;
    delivery_status: string | null;
    delivery_method: string | null;
    is_superseded: boolean;
    influencer_id: string;
    amount: number | null;
    currency_code: string | null;
    document_number: string | null;
  }>;
}

async function planRevisionRequiredVendorIoReactions(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
): Promise<PlannedDocumentReaction[]> {
  const rows = await loadCampaignVendorIos(supabase, input);
  const out: PlannedDocumentReaction[] = [];

  for (const row of rows) {
    if (row.status === "cancelled") continue;
    if (row.status === "revision_required") continue;

    const issued = isVendorIoIssued({
      documentType: "vendor_io",
      id: row.id,
      status: row.status,
      isSuperseded: row.is_superseded,
      sentAt: row.sent_at,
      deliveryStatus: row.delivery_status,
      deliveryMethod: row.delivery_method,
    });
    if (!issued) continue;

    out.push({
      documentType: "vendor_io",
      documentId: row.id,
      fromStatus: row.status,
      toStatus: "revision_required",
      reasonCode: input.reasonCode,
      reasonDetail: input.reasonDetail,
      recommendedActions: [
        "preview_changes",
        "regenerate",
        "send_updated_version",
      ],
      aiContext: {
        previous_status: row.status,
        amount: row.amount,
        currency_code: row.currency_code,
        document_number: row.document_number,
      },
    });
  }

  return out;
}

async function planRevisionRequiredClientIoReactions(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
): Promise<PlannedDocumentReaction[]> {
  if (
    input.eventType !== "creator_price_updated" &&
    input.eventType !== "deliverables_changed" &&
    input.eventType !== "payment_terms_changed" &&
    input.eventType !== "campaign_budget_changed" &&
    input.eventType !== "manual_mark_revision_required"
  ) {
    return [];
  }

  const { data, error } = await supabase
    .from("client_ios")
    .select("id, status, is_superseded, sent_at, document_number")
    .eq("campaign_header_id", input.campaignHeaderId)
    .eq("is_superseded", false);

  if (error) throw new Error(error.message);

  const out: PlannedDocumentReaction[] = [];
  for (const raw of data ?? []) {
    const row = raw as {
      id: string;
      status: string;
      is_superseded: boolean;
      sent_at: string | null;
      document_number: string | null;
    };
    if (row.is_superseded) continue;
    if (row.status === "cancelled" || row.status === "draft") continue;
    if (row.status === "revision_required") continue;

    const issued =
      row.status === "sent" ||
      row.status === "under_client_review" ||
      row.status === "approved" ||
      row.status === "rejected" ||
      Boolean(row.sent_at);
    if (!issued) continue;

    out.push({
      documentType: "client_io",
      documentId: row.id,
      fromStatus: row.status,
      toStatus: "revision_required",
      reasonCode: input.reasonCode,
      reasonDetail: input.reasonDetail,
      recommendedActions: ["preview_changes", "regenerate", "send_updated_version"],
      aiContext: {
        commercial_review: true,
        document_number: row.document_number,
      },
    });
  }
  return out;
}

async function planCreatorRemovedVendorIoReactions(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
): Promise<PlannedDocumentReaction[]> {
  const rows = await loadCampaignVendorIos(supabase, input);
  const out: PlannedDocumentReaction[] = [];

  for (const row of rows) {
    if (row.status === "cancelled" || row.status === "approved") continue;
    out.push({
      documentType: "vendor_io",
      documentId: row.id,
      fromStatus: row.status,
      toStatus: "cancelled",
      reasonCode: input.reasonCode,
      reasonDetail: input.reasonDetail,
      recommendedActions: ["view"],
      aiContext: { document_number: row.document_number },
    });
  }
  return out;
}

async function planCampaignCancelVendorIoReactions(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
): Promise<PlannedDocumentReaction[]> {
  const rows = await loadCampaignVendorIos(supabase, input);
  const out: PlannedDocumentReaction[] = [];

  for (const row of rows) {
    if (row.status === "approved") continue;
    if (row.status === "cancelled") continue;

    out.push({
      documentType: "vendor_io",
      documentId: row.id,
      fromStatus: row.status,
      toStatus: "cancelled",
      reasonCode: "campaign_cancelled",
      reasonDetail: input.reasonDetail || "Campaign cancelled",
      recommendedActions: ["view"],
      aiContext: { document_number: row.document_number },
    });
  }
  return out;
}

async function planCampaignCancelClientIoReactions(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
): Promise<PlannedDocumentReaction[]> {
  const { data, error } = await supabase
    .from("client_ios")
    .select("id, status, is_superseded, document_number")
    .eq("campaign_header_id", input.campaignHeaderId)
    .eq("is_superseded", false);

  if (error) throw new Error(error.message);

  const out: PlannedDocumentReaction[] = [];
  for (const raw of data ?? []) {
    const row = raw as {
      id: string;
      status: string;
      is_superseded: boolean;
      document_number: string | null;
    };
    if (row.status === "approved") continue;
    if (row.status === "cancelled") continue;

    out.push({
      documentType: "client_io",
      documentId: row.id,
      fromStatus: row.status,
      toStatus: "cancelled",
      reasonCode: "campaign_cancelled",
      reasonDetail: input.reasonDetail || "Campaign cancelled",
      recommendedActions: ["view"],
      aiContext: { document_number: row.document_number },
    });
  }
  return out;
}
