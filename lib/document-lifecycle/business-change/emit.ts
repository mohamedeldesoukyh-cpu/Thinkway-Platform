import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isVendorIoIssued,
} from "@/lib/document-lifecycle/policies/vendor-io";
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
  /** Optional: limit Vendor IO reactions to these tip IDs. */
  vendorIoIds?: string[];
  /** Optional: limit to influencer's Vendor IOs on the campaign. */
  influencerId?: string | null;
  /** Optional: campaign lines that changed (for lookup). */
  campaignLineIds?: string[];
  /** Estimated commercial delta for AI-ready reaction context. */
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
 * One business event → many document reactions.
 * Never mutates campaign Business State; only document lifecycle.
 *
 * Policy (approved Option D):
 * - Accepted + business change → Revision Required (never silent mutate)
 * - Campaign cancel → cancel outstanding only; Accepted remains Accepted
 */
export async function emitBusinessChangeEvent(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
): Promise<EmitBusinessChangeResult> {
  const { data: eventRow, error: eventError } = await supabase
    .from("business_change_events")
    .insert({
      event_type: input.eventType,
      reason_code: input.reasonCode,
      reason_detail: input.reasonDetail,
      campaign_header_id: input.campaignHeaderId,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      payload: input.payload ?? {},
      actor_id: input.actorId ?? null,
    } as never)
    .select("id")
    .maybeSingle();

  if (eventError || !eventRow) {
    return {
      ok: false,
      error: eventError?.message ?? "Failed to record business change event.",
    };
  }

  const eventId = (eventRow as { id: string }).id;
  const reactions: PlannedDocumentReaction[] = [];

  if (input.eventType === "campaign_cancelled") {
    reactions.push(
      ...(await planCampaignCancelVendorIoReactions(supabase, input)),
      ...(await planCampaignCancelClientIoReactions(supabase, input))
    );
  } else if (
    input.eventType === "creator_removed" ||
    input.eventType === "creator_replaced"
  ) {
    reactions.push(...(await planCreatorRemovedVendorIoReactions(supabase, input)));
  } else {
    reactions.push(
      ...(await planRevisionRequiredVendorIoReactions(supabase, input)),
      ...(await planRevisionRequiredClientIoReactions(supabase, input))
    );
  }

  const now = new Date().toISOString();

  for (const reaction of reactions) {
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
      business_change_event_id: eventId,
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

  return { ok: true, eventId, reactions };
}

async function loadCampaignVendorIos(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
) {
  let query = supabase
    .from("vendor_ios")
    .select(
      "id, status, sent_at, delivery_status, delivery_method, is_superseded, influencer_id, amount, currency_code"
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
      },
    });
  }

  return out;
}

async function planRevisionRequiredClientIoReactions(
  supabase: SupabaseClient,
  input: EmitBusinessChangeInput
): Promise<PlannedDocumentReaction[]> {
  // Commercial / budget changes may require Client IO commercial review.
  // Creator-only price changes still notify Client IO tip when issued.
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
    .select("id, status, is_superseded, sent_at")
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
      aiContext: { commercial_review: true },
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
    // Accepted documents are legal history — never rewrite to Cancelled.
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
    .select("id, status, is_superseded")
    .eq("campaign_header_id", input.campaignHeaderId)
    .eq("is_superseded", false);

  if (error) throw new Error(error.message);

  const out: PlannedDocumentReaction[] = [];
  for (const raw of data ?? []) {
    const row = raw as { id: string; status: string; is_superseded: boolean };
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
    });
  }
  return out;
}
