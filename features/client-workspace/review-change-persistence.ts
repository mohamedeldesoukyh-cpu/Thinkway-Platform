import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientChangeArea, ClientCommentTargetType } from "./constants";
import type { ClientReviewRecord } from "./types";
import { withoutSelectionConfirmation } from "./reopen-selection";

type Review = Pick<ClientReviewRecord, "id" | "updatedAt" | "sourceSnapshot" | "clientLabel">;

/** The caller must validate token, permissions and review lifecycle before writing. */
export async function persistClientReviewChange(
  supabase: SupabaseClient,
  review: Review,
  change: { kind: "reopen" } | { kind: "request"; summary: string; areas: ClientChangeArea[]; targetType?: ClientCommentTargetType; targetId?: string | null }
): Promise<{ ok: boolean; message: string }> {
  const summary = change.kind === "request" ? change.summary.trim() : "";
  if (change.kind === "request" && !summary) return { ok: false, message: "Describe the change you need." };
  if (change.kind === "reopen" && !review.sourceSnapshot) return { ok: false, message: "Package not found." };
  const areas = change.kind === "request" && change.areas.length ? change.areas : ["campaign"];
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...(review.sourceSnapshot ? { source_snapshot: withoutSelectionConfirmation(review.sourceSnapshot) } : {}),
    ...(change.kind === "request" ? {
      status: "changes_requested", change_request_summary: summary, change_request_areas: areas,
    } : {}),
  };
  const { error } = await supabase.from("campaign_client_reviews" as never).update(patch as never)
    .eq("id", review.id).eq("updated_at", review.updatedAt).select("id").single();
  if (error) return { ok: false, message: "Could not save the change. Refresh the workspace and try again." };
  let commentFailed = false;
  if (change.kind === "request") {
    const comment = await supabase.from("campaign_client_review_comments" as never).insert({
      review_id: review.id, target_type: change.targetType ?? "campaign", target_id: change.targetId ?? null,
      author_kind: "client", author_label: review.clientLabel ?? "Client", message: summary, status: "open",
    } as never);
    commentFailed = Boolean(comment.error);
  }
  await supabase.from("campaign_client_review_events" as never).insert({
    review_id: review.id, event_type: change.kind === "request" ? "changes_requested" : "selection_reopened",
    actor_kind: "client", actor_label: review.clientLabel ?? "Client",
    payload: change.kind === "request" ? { summary, areas } : {},
  } as never);
  return { ok: true, message: change.kind === "request" ? (commentFailed ? "Change request saved. Its conversation entry could not be added; Thinkway can still see the request summary." : "Change request sent to Thinkway.")
    : "You can edit your selection. Confirm it again before approving the quotation." };
}
