"use server";

import { revalidatePath } from "next/cache";

import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { quotationDetailPath } from "@/lib/routing/entity-paths";

import type { ClientCreatorSelectionState } from "../constants";
import { loadLatestInternalReviewForQuotation } from "../load-client-workspace";
import { clientSelectionToShortlistStatus } from "../status";

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
  if (review.status === "superseded" || review.status === "revoked") {
    return { ok: false, message: "This client review is no longer open." };
  }
  const ids = [...new Set(input.creatorIds.filter(Boolean))];
  if (ids.length === 0) return { ok: false, message: "Select at least one creator." };

  const selection = { ...review.selectionState };
  for (const id of ids) selection[id] = input.state;
  const acceptedIds = Object.entries(selection)
    .filter(([, state]) => state === "accepted")
    .map(([id]) => id);
  const patch: Record<string, unknown> = {
    selection_state: selection,
    updated_at: new Date().toISOString(),
  };
  if (review.status === "approved") {
    patch.approved_creator_ids = acceptedIds;
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
        .update({ item_status: clientSelectionToShortlistStatus(input.state) } as never)
        .eq("shortlist_id", review.shortlistId)
        .or(
          `id.eq.${creatorId},influencer_id.eq.${rawId},profile_id.eq.${rawId},unified_id.eq.${creatorId},unified_id.eq.${rawId}`
        );
    }
  }

  await supabase.from("campaign_client_review_events" as never).insert({
    review_id: review.id,
    event_type: input.state === "rejected" ? "creator_rejected" : "creator_selected",
    actor_kind: "internal",
    actor_label: "Thinkway",
    payload: { creatorIds: ids, state: input.state, onBehalfOfClient: true },
  } as never);

  revalidatePath(quotationDetailPath(input.quotationId));
  return {
    ok: true,
    message:
      input.state === "accepted"
        ? "Marked approved on behalf of the client."
        : input.state === "rejected"
          ? "Marked rejected on behalf of the client."
          : "Moved back to under review.",
  };
}
