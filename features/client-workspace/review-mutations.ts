import { notifyShortlistEvent } from "@/features/discovery/shortlists/notifications";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ClientChangeArea,
  ClientCommentTargetType,
  ClientCreatorSelectionState,
  ClientReviewDecisionStage,
} from "./constants";
import { mapClientReviewRow } from "./persist-client-review";
import {
  loadJourneyReviews,
  newerReviewNumberFor,
  resolveClientReviewByToken,
} from "./load-client-workspace";
import { clientCreatorIds, projectClientCommercial } from "./project-client-view";
import { projectCommercialFromSnapshot, snapshotCreatorIds } from "./snapshot";
import {
  isFrozenClientReviewStatus,
  isInteractiveClientReview,
} from "./status";
import { clientApprovalSideEffects, canMutateClientReviewFromBoundReview, journeyCanonicalReviewId, pickReviewForDecision } from "./journey-state";
import {
  isPricedClientInvestment,
  isSelectionConfirmed,
  selectionCalculator,
  selectionChangeAllowed,
  UNPRICED_SELECTED_CODE,
  unpricedSelectedIds,
  withClientSelectionFreeze,
} from "./selection-flow";
import { logQuotationLifecycleEvent } from "@/lib/commercial-sync/audit";
import { updateQuotationHeaderRecord } from "@/lib/services/quotations/repositories/quotation-repository";

function db(): SupabaseClient {
  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    throw new Error("Client Workspace is temporarily unavailable.");
  }
  return service;
}

async function requireInteractiveReview(
  token: string,
  inputStage?: ClientReviewDecisionStage
) {
  const resolved = await resolveClientReviewByToken(db(), token);
  if (!resolved.ok) {
    return { ok: false as const, message: "This review link is invalid or has expired." };
  }
  const members = await loadJourneyReviews(db(), resolved.review);
  const canonicalReviewId = journeyCanonicalReviewId(members, resolved.review.id);
  if (
    !canMutateClientReviewFromBoundReview({
      reviews: members,
      boundReviewId: resolved.review.id,
      canonicalReviewId,
    })
  ) {
    return { ok: false as const, message: "This version is no longer open for decisions." };
  }
  const target = inputStage
    ? pickReviewForDecision(members, inputStage)
    : pickReviewForDecision(members, "quotation") ??
      pickReviewForDecision(members, "shortlist") ??
      resolved.review;
  if (!target) {
    return { ok: false as const, message: "This version is no longer open for decisions." };
  }
  if (target.campaignHeaderId && target.source === "quotation") {
    return { ok: false as const, message: "This quotation is already in a campaign." };
  }
  if (!isInteractiveClientReview(target.status)) {
    return { ok: false as const, message: "This version is no longer open for decisions." };
  }
  const newer = await newerReviewNumberFor(db(), target);
  if (newer) {
    return { ok: false as const, message: "A new version requires review. Decisions on this version are closed." };
  }
  return { ok: true as const, review: target, members };
}

function commerciallyApproved(review: { status: string; source: string }): boolean {
  return review.source === "quotation" && review.status === "approved";
}

function creatorIsPriced(
  review: { sourceSnapshot: { creators: Array<{ creatorId: string; investmentAmount?: number }> } | null },
  creatorId: string
): boolean {
  const creator = review.sourceSnapshot?.creators.find((item) => item.creatorId === creatorId);
  return isPricedClientInvestment(creator?.investmentAmount);
}

async function notifyOpsOfClientReviewChange(input: {
  reviewId: string;
  quotationId?: string | null;
  shortlistId?: string | null;
  body: string;
}) {
  try {
    const { data: quote } = input.quotationId
      ? await db()
          .from("quotations")
          .select("owner_id, shortlist_id")
          .eq("id", input.quotationId)
          .maybeSingle()
      : { data: null };
    const quoteRow = quote as { owner_id?: string | null; shortlist_id?: string | null } | null;
    const shortlistId = input.shortlistId || quoteRow?.shortlist_id || null;
    if (!shortlistId) return;
    const { data: reviewRow } = await db()
      .from("campaign_client_reviews" as never)
      .select("created_by")
      .eq("id", input.reviewId)
      .maybeSingle();
    const createdBy = (reviewRow as { created_by?: string } | null)?.created_by;
    await notifyShortlistEvent(db() as never, {
      shortlistId,
      event: "approved",
      body: input.body,
      actorId: createdBy || quoteRow?.owner_id || "",
      recipientIds: [quoteRow?.owner_id, createdBy],
      metadata: { quotationId: input.quotationId, reviewId: input.reviewId },
    });
  } catch (error) {
    console.error("[client-review-notify]", error);
  }
}

async function loadFrozenObject(campaignObjectId: string, version: number) {
  const loaded = await CampaignObjectPersistenceService.loadVersion(
    db() as never,
    campaignObjectId,
    version
  );
  return loaded?.campaignObject ?? null;
}

export async function setCreatorSelection(input: {
  token: string;
  creatorId: string;
  state: ClientCreatorSelectionState;
  creatorName?: string;
  reason?: string;
}): Promise<{ ok: boolean; message: string; selection?: Record<string, ClientCreatorSelectionState> }> {
  const gate = await requireInteractiveReview(input.token);
  if (!gate.ok) return gate;

  const current = gate.review.selectionState[input.creatorId] ?? "in_review";
  const allowed = selectionChangeAllowed({
    selectionConfirmed: isSelectionConfirmed(gate.review.sourceSnapshot),
    commerciallyApproved: commerciallyApproved(gate.review),
    current,
    next: input.state,
    priced: creatorIsPriced(gate.review, input.creatorId),
  });
  if (!allowed.ok) return { ok: false, message: allowed.message ?? "Selection cannot be changed." };

  const selection = { ...gate.review.selectionState, [input.creatorId]: input.state };
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update({
      selection_state: selection,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", gate.review.id);
  if (error) return { ok: false, message: error.message };

  await db().from("campaign_client_review_events" as never).insert({
    review_id: gate.review.id,
    event_type: input.state === "rejected" ? "creator_rejected" : "creator_selected",
    actor_kind: "client",
    actor_label: gate.review.clientLabel ?? "Client",
    payload: {
      creatorId: input.creatorId,
      name: input.creatorName,
      state: input.state,
      reason: input.reason?.trim() || null,
    },
  } as never);

  await notifyOpsOfClientReviewChange({
    reviewId: gate.review.id,
    quotationId: gate.review.quotationId,
    shortlistId: gate.review.shortlistId,
    body:
      input.state === "accepted"
        ? `${input.creatorName || "A creator"} was selected on the client review.`
        : input.state === "rejected"
          ? `${input.creatorName || "A creator"} was removed from the selection.`
          : `${input.creatorName || "A creator"} was moved back to not selected.`,
  });

  const reason = input.reason?.trim();
  if (reason && (input.state === "rejected" || input.state === "in_review")) {
    await db().from("campaign_client_review_comments" as never).insert({
      review_id: gate.review.id,
      target_type: "creator",
      target_id: input.creatorId,
      author_kind: "client",
      author_label: gate.review.clientLabel ?? "Client",
      message: input.state === "rejected" ? `Reject reason: ${reason}` : reason,
      status: "open",
    } as never);
  }

  return { ok: true, message: "Selection saved.", selection };
}

export async function setBulkCreatorSelection(input: {
  token: string;
  state: ClientCreatorSelectionState;
  creatorIds?: string[];
}): Promise<{ ok: boolean; message: string }> {
  const gate = await requireInteractiveReview(input.token);
  if (!gate.ok) return gate;
  const ids =
    input.creatorIds?.length
      ? input.creatorIds
      : gate.review.sourceSnapshot
        ? snapshotCreatorIds(gate.review.sourceSnapshot)
        : await (async () => {
            if (!gate.review.campaignObjectId) return Object.keys(gate.review.selectionState);
            const campaignObject = await loadFrozenObject(
              gate.review.campaignObjectId,
              gate.review.frozenVersion
            );
            return campaignObject ? clientCreatorIds(campaignObject) : Object.keys(gate.review.selectionState);
          })();
  const selection = { ...gate.review.selectionState };
  const confirmed = isSelectionConfirmed(gate.review.sourceSnapshot);
  for (const id of ids) {
    const allowed = selectionChangeAllowed({
      selectionConfirmed: confirmed,
      commerciallyApproved: commerciallyApproved(gate.review),
      current: selection[id] ?? "in_review",
      next: input.state,
      priced: creatorIsPriced(gate.review, id),
    });
    if (!allowed.ok) return { ok: false, message: allowed.message ?? "Selection cannot be changed." };
    selection[id] = input.state;
  }
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update({ selection_state: selection, updated_at: new Date().toISOString() } as never)
    .eq("id", gate.review.id);
  if (error) return { ok: false, message: error.message };

  await notifyOpsOfClientReviewChange({
    reviewId: gate.review.id,
    quotationId: gate.review.quotationId,
    shortlistId: gate.review.shortlistId,
    body: `Client updated ${ids.length} creator${ids.length === 1 ? "" : "s"} on the quotation review.`,
  });

  return { ok: true, message: "Selection updated." };
}

export async function addClientComment(input: {
  token: string;
  targetType: ClientCommentTargetType;
  targetId?: string | null;
  message: string;
  stage?: ClientReviewDecisionStage;
}): Promise<{ ok: boolean; message: string }> {
  const gate = await requireInteractiveReview(input.token, input.stage);
  if (!gate.ok) return gate;
  const text = input.message.trim();
  if (!text) return { ok: false, message: "Enter a comment." };
  const { error } = await db().from("campaign_client_review_comments" as never).insert({
    review_id: gate.review.id,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    author_kind: "client",
    author_label: gate.review.clientLabel ?? "Client",
    message: text,
    status: "open",
  } as never);
  if (error) return { ok: false, message: error.message };
  await db().from("campaign_client_review_events" as never).insert({
    review_id: gate.review.id,
    event_type: "comment_added",
    actor_kind: "client",
    actor_label: gate.review.clientLabel ?? "Client",
    payload: { targetType: input.targetType },
  } as never);
  return { ok: true, message: "Comment added." };
}

export async function requestClientChanges(input: {
  token: string;
  summary: string;
  areas: ClientChangeArea[];
  stage?: ClientReviewDecisionStage;
}): Promise<{ ok: boolean; message: string }> {
  const gate = await requireInteractiveReview(input.token, input.stage);
  if (!gate.ok) return gate;
  const summary = input.summary.trim();
  if (!summary) return { ok: false, message: "Describe the change you need." };
  const areas = input.areas.length > 0 ? input.areas : (["campaign"] as ClientChangeArea[]);
  const patch: Record<string, unknown> = {
    status: "changes_requested",
    change_request_summary: summary,
    change_request_areas: areas,
    updated_at: new Date().toISOString(),
  };
  if (gate.review.sourceSnapshot?.clientSelection) {
    const nextSnapshot = { ...gate.review.sourceSnapshot };
    delete nextSnapshot.clientSelection;
    patch.source_snapshot = nextSnapshot;
  }
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update(patch as never)
    .eq("id", gate.review.id);
  if (error) return { ok: false, message: error.message };
  await db().from("campaign_client_review_events" as never).insert({
    review_id: gate.review.id,
    event_type: "changes_requested",
    actor_kind: "client",
    actor_label: gate.review.clientLabel ?? "Client",
    payload: { summary, areas },
  } as never);
  return { ok: true, message: "Change request sent to Thinkway." };
}

export async function confirmClientCreators(input: {
  token: string;
}): Promise<{ ok: boolean; message: string; code?: string }> {
  const gate = await requireInteractiveReview(input.token);
  if (!gate.ok) return gate;
  const snapshot = gate.review.sourceSnapshot;
  if (!snapshot) return { ok: false, message: "Package not found." };
  if (isSelectionConfirmed(snapshot)) {
    return { ok: true, message: "Creators already approved. This is not quotation approval." };
  }
  const acceptedIds = snapshot.creators
    .map((creator) => creator.creatorId)
    .filter((id) => gate.review.selectionState[id] === "accepted");
  if (acceptedIds.length === 0) {
    return { ok: false, message: "Select at least one creator before approving." };
  }
  const now = new Date().toISOString();
  const nextSnapshot = withClientSelectionFreeze(snapshot, {
    confirmedAt: now,
    creatorIds: acceptedIds,
  });
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update({
      source_snapshot: nextSnapshot,
      updated_at: now,
    } as never)
    .eq("id", gate.review.id)
    .in("status", ["awaiting_review", "changes_requested"]);
  if (error) return { ok: false, message: error.message };
  await db().from("campaign_client_review_events" as never).insert({
    review_id: gate.review.id,
    event_type: "creators_confirmed",
    actor_kind: "client",
    actor_label: gate.review.clientLabel ?? "Client",
    payload: {
      creatorIds: acceptedIds,
      lockCommercial: false,
      setQuotationStatusApproved: false,
    },
  } as never);
  await notifyOpsOfClientReviewChange({
    reviewId: gate.review.id,
    quotationId: gate.review.quotationId,
    shortlistId: gate.review.shortlistId,
    body: `Client approved ${acceptedIds.length} creator${acceptedIds.length === 1 ? "" : "s"} for the quotation. This is not quotation approval.`,
  });
  return { ok: true, message: "Creators approved. This is not quotation approval." };
}

export async function removeUnpricedSelectedCreators(input: {
  token: string;
}): Promise<{ ok: boolean; message: string; selection?: Record<string, ClientCreatorSelectionState> }> {
  const gate = await requireInteractiveReview(input.token);
  if (!gate.ok) return gate;
  const snapshot = gate.review.sourceSnapshot;
  if (!snapshot) return { ok: false, message: "Package not found." };
  const ids = unpricedSelectedIds(snapshot.creators, gate.review.selectionState);
  if (ids.length === 0) return { ok: true, message: "No unpriced creators in the selection.", selection: gate.review.selectionState };
  const selection = { ...gate.review.selectionState };
  for (const id of ids) selection[id] = "in_review";
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update({
      selection_state: selection,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", gate.review.id);
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    message: "Unpriced creators were removed from this quotation selection. They remain on the shortlist.",
    selection,
  };
}

export async function decideClientReview(input: {
  token: string;
  decision: "approved" | "rejected";
  actorLabel?: string;
  reason?: string;
  stage?: ClientReviewDecisionStage;
}): Promise<{ ok: boolean; message: string; quotationId?: string; code?: string }> {
  const stage: ClientReviewDecisionStage | undefined =
    input.stage ?? (input.decision === "rejected" ? "quotation" : undefined);
  const gate = await requireInteractiveReview(input.token, stage);
  if (!gate.ok) return gate;

  if (input.decision === "rejected") {
    if (gate.review.source === "shortlist") {
      return { ok: false, message: "Reject quotation does not apply to the shortlist." };
    }
    if (!input.reason?.trim()) {
      return { ok: false, message: "Please provide a reason for rejecting this quotation." };
    }
  }

  const snapshot = gate.review.sourceSnapshot;
  const campaignObject =
    !snapshot && gate.review.campaignObjectId
      ? await loadFrozenObject(gate.review.campaignObjectId, gate.review.frozenVersion)
      : null;
  if (!snapshot && !campaignObject) {
    return { ok: false, message: "Package not found." };
  }

  const commercial = snapshot
    ? projectCommercialFromSnapshot(snapshot, gate.review.selectionState)
    : projectClientCommercial(campaignObject!, gate.review.selectionState);
  const frozenIds = snapshot
    ? snapshotCreatorIds(snapshot)
    : clientCreatorIds(campaignObject!);
  const selectedIds = frozenIds.filter((id) => gate.review.selectionState[id] === "accepted");

  if (input.decision === "approved" && selectedIds.length === 0) {
    return {
      ok: false,
      message:
        gate.review.source === "shortlist"
          ? "Select at least one creator before confirming."
          : "Select at least one creator before approving the quotation.",
    };
  }

  if (input.decision === "approved" && gate.review.source === "quotation") {
    if (!isSelectionConfirmed(snapshot ?? undefined)) {
      return {
        ok: false,
        message: "Confirm the creators you would like included in your campaign quotation first.",
      };
    }
    if (snapshot) {
      const calc = selectionCalculator(snapshot.creators, gate.review.selectionState);
      if (calc.pricedSelectedCount === 0) {
        return {
          ok: false,
          message: "This quotation has no confirmed pricing for the selected creators yet.",
          code: UNPRICED_SELECTED_CODE,
        };
      }
    }
  }

  const effects = clientApprovalSideEffects(gate.review.source, input.decision);
  const isShortlistDecision = gate.review.source === "shortlist";
  const now = new Date().toISOString();
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update({
      status: input.decision,
      approved_creator_ids: input.decision === "approved" ? selectedIds : [],
      approved_commercial: input.decision === "approved" && effects.lockCommercial ? commercial : null,
      approved_at: now,
      approved_by_label: input.actorLabel?.trim() || gate.review.clientLabel || "Client",
      updated_at: now,
    } as never)
    .eq("id", gate.review.id)
    .in("status", ["awaiting_review", "changes_requested"]);
  if (error) return { ok: false, message: error.message };

  await db().from("campaign_client_review_events" as never).insert({
    review_id: gate.review.id,
    event_type:
      input.decision === "approved"
        ? isShortlistDecision
          ? "shortlist_approved"
          : "quotation_approved"
        : "client_rejected",
    actor_kind: "client",
    actor_label: input.actorLabel?.trim() || gate.review.clientLabel || "Client",
    payload: {
      version: gate.review.reviewNumber,
      frozen_version: gate.review.frozenVersion,
      selected_creators: selectedIds,
      commercial: effects.lockCommercial ? commercial : null,
      reason: input.reason?.trim() || undefined,
    },
  } as never);

  if (input.decision !== "approved") {
    return { ok: true, message: "Quotation rejected. The shortlist is unchanged." };
  }

  if (isShortlistDecision) {
    await notifyOpsOfClientReviewChange({
      reviewId: gate.review.id,
      shortlistId: gate.review.shortlistId,
      body: "Client approved the creator shortlist for consideration. This is not commercial approval.",
    });
    return { ok: true, message: "Shortlist approved for consideration." };
  }

  if (effects.setQuotationStatusApproved) {
    if (gate.review.quotationId) {
      await updateQuotationHeaderRecord(db() as never, gate.review.quotationId, {
        status: "approved",
      });
      const { data: ownerRow } = await db()
        .from("campaign_client_reviews" as never)
        .select("created_by")
        .eq("id", gate.review.id)
        .maybeSingle();
      const actorId = (ownerRow as { created_by?: string } | null)?.created_by ?? null;
      await logQuotationLifecycleEvent(db() as never, {
        quotationId: gate.review.quotationId,
        actorId,
        event: "quotation.client_approved",
        summary: "Client approved the quotation. Campaign conversion is now allowed.",
        newData: { status: "approved" },
        metadata: {
          review_id: gate.review.id,
          journey_id: gate.review.journeyId ?? gate.review.id,
          actor_label: input.actorLabel?.trim() || gate.review.clientLabel || "Client",
          actor_kind: "client",
          approval_source: "client_workspace",
        },
      });
    }
    await notifyOpsOfClientReviewChange({
      reviewId: gate.review.id,
      quotationId: gate.review.quotationId,
      shortlistId: gate.review.shortlistId,
      body: `Client approved the quotation (${selectedIds.length} creator${selectedIds.length === 1 ? "" : "s"}).`,
    });
    return {
      ok: true,
      message: "Quotation approved. Thinkway can convert this quotation to a campaign.",
      quotationId: gate.review.quotationId ?? undefined,
    };
  }

  if (!effects.createQuotation) {
    return { ok: true, message: "Approved." };
  }

  const { data: ownerRow } = await db()
    .from("campaign_client_reviews" as never)
    .select("created_by")
    .eq("id", gate.review.id)
    .maybeSingle();
  const actorId = (ownerRow as { created_by?: string } | null)?.created_by;
  if (!actorId) {
    return { ok: true, message: "Approved." };
  }

  try {
    const { createQuotationFromSelection, createQuotationFromShortlist } = await import(
      "@/lib/services/quotations/quotation-service"
    );
    let quotation: Awaited<ReturnType<typeof createQuotationFromShortlist>>;
    if (gate.review.shortlistId) {
      quotation = await createQuotationFromShortlist(db() as never, actorId, gate.review.shortlistId);
    } else {
      const perCreator =
        commercial.selectedCount > 0
          ? Math.round(commercial.totalInvestment / commercial.selectedCount)
          : null;
      quotation = await createQuotationFromSelection(db() as never, actorId, {
        name: `${gate.review.campaignName ?? "Campaign"} — Client approved v${gate.review.reviewNumber}`,
        creators: selectedIds.map((creatorId) => ({
          creator_name: creatorId,
          influencer_id: creatorId.replace(/^inf:/, ""),
          unified_id: creatorId,
          revenue: perCreator,
          cost_currency: commercial.currency,
        })),
      });
    }
    if (quotation.ok) {
      return {
        ok: true,
        message: "Approved. Quotation reflects the selected creators.",
        quotationId: quotation.data?.id,
      };
    }
    return { ok: true, message: `Approved. Quotation will be generated internally (${quotation.message}).` };
  } catch (error) {
    return {
      ok: true,
      message: `Approved. Quotation handoff pending: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export async function acknowledgeClientUpdate(input: { token: string }): Promise<{ ok: boolean }> {
  const resolved = await resolveClientReviewByToken(db(), input.token);
  if (!resolved.ok) return { ok: false };
  const members = await loadJourneyReviews(db(), resolved.review);
  const open = members.find((item) => isInteractiveClientReview(item.status)) ?? resolved.review;
  if (isFrozenClientReviewStatus(open.status)) return { ok: true };
  const snapshot = open.sourceSnapshot;
  if (!snapshot?.clientUpdate?.items.length || snapshot.clientUpdate.acknowledgedAt) {
    return { ok: true };
  }
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update({
      source_snapshot: {
        ...snapshot,
        clientUpdate: {
          ...snapshot.clientUpdate,
          acknowledgedAt: new Date().toISOString(),
        },
      },
    } as never)
    .eq("id", open.id)
    .in("status", ["awaiting_review", "changes_requested"]);
  return { ok: !error };
}

export function mapReview(row: unknown) {
  return mapClientReviewRow(row as Parameters<typeof mapClientReviewRow>[0]);
}
