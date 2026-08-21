"use server";

import { revalidatePath } from "next/cache";

import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { quotationDetailPath } from "@/lib/routing/entity-paths";

import type { ClientCreatorSelectionState } from "../constants";
import { loadLatestInternalReviewForQuotation } from "../load-client-workspace";
import { isFrozenClientReviewStatus } from "../status";

export async function setQuotationReviewCreatorsOnBehalfAction(input: {
  quotationId: string;
  creatorIds: string[];
  state: ClientCreatorSelectionState;
}): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) {
    const adminAuth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
    if ("error" in adminAuth) return { ok: false, message: auth.error };
  }
  const review = await loadLatestInternalReviewForQuotation(supabase, input.quotationId);
  if (!review) return { ok: false, message: "This quotation has no client review yet." };
  if (isFrozenClientReviewStatus(review.status)) {
    return { ok: false, message: "This client review is no longer open." };
  }
  const ids = [...new Set(input.creatorIds.filter(Boolean))];
  if (ids.length === 0) return { ok: false, message: "Select at least one creator." };

  const snapshot = review.sourceSnapshot;
  const thinkwayStatus =
    input.state === "accepted" ? "approved" : input.state === "rejected" ? "not_reviewed" : "recommended";
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (snapshot) {
    patch.source_snapshot = {
      ...snapshot,
      creators: snapshot.creators.map((creator) =>
        ids.includes(creator.creatorId) ? { ...creator, thinkwayStatus } : creator
      ),
    };
  }

  const { error } = await supabase
    .from("campaign_client_reviews" as never)
    .update(patch as never)
    .eq("id", review.id);
  if (error) return { ok: false, message: error.message };

  if (review.shortlistId) {
    for (const creatorId of ids) {
      const rawId = creatorId.replace(/^(inf|dis):/, "");
      await supabase
        .from("discovery_shortlist_items")
        .update({ item_status: input.state === "accepted" ? "approved" : "under_review" } as never)
        .eq("shortlist_id", review.shortlistId)
        .or(
          `id.eq.${creatorId},influencer_id.eq.${rawId},profile_id.eq.${rawId},unified_id.eq.${creatorId},unified_id.eq.${rawId}`
        );
    }
  }

  await supabase.from("campaign_client_review_events" as never).insert({
    review_id: review.id,
    event_type: "thinkway_creator_status",
    actor_kind: "internal",
    actor_label: "Thinkway",
    payload: { creatorIds: ids, thinkwayStatus, onBehalfOfClient: false },
  } as never);

  revalidatePath(quotationDetailPath(input.quotationId));
  return {
    ok: true,
    message:
      thinkwayStatus === "approved"
        ? "Marked as approved by Thinkway. The client still needs to make their own selection."
        : thinkwayStatus === "not_reviewed"
          ? "Thinkway recommendation cleared. Client selection is unchanged."
          : "Marked as recommended by Thinkway. The client still needs to make their own selection.",
  };
}
