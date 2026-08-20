import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { hydrateSlateCreators } from "@/features/campaign-studio/services/copilot/slate-edit-mutations";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { type ClientCreatorSelectionState } from "./constants";
import { mapClientReviewRow } from "./persist-client-review";
import {
  projectClientContent,
  projectClientCreators,
  projectClientOverview,
  projectClientTimeline,
  projectClientCommercial,
} from "./project-client-view";
import {
  projectCommercialFromSnapshot,
  projectCreatorsFromSnapshot,
  projectOverviewFromSnapshot,
  visibleClientUpdateNotice,
} from "./snapshot";
import { applyCreatorForecasts, projectClientMediaPlans } from "./media-plan-summary";
import { snapshotFromCampaignObject } from "./snapshot-from-object";
import { isInteractiveClientReview } from "./status";
import {
  canLiveSyncClientReview,
  deriveQuotationStage,
  deriveShortlistStage,
  journeyActionRequired,
  journeyCanonicalReviewId,
  latestApprovedReviewForSource,
  latestReviewForSource,
  pickActiveDecisionReview,
} from "./journey-state";
import { diffShortlistToQuotation } from "./snapshot-diff";
import type {
  ClientActivityEvent,
  ClientComment,
  ClientReviewRecord,
  ClientReviewSourceSnapshot,
  ClientWorkspaceEntry,
  ClientWorkspaceJourney,
  ClientWorkspaceView,
} from "./types";
import { visibleClientWorkspaceSections } from "./visible-sections";

export type ResolvedClientReview =
  | { ok: true; review: ClientReviewRecord }
  | { ok: false; code: "invalid" | "revoked" | "not_found" };

function serviceClient(): SupabaseClient | null {
  return tryCreateServiceRoleClient().client;
}

export async function resolveClientReviewByToken(
  supabase: SupabaseClient,
  token: string
): Promise<ResolvedClientReview> {
  const trimmed = token.trim();
  if (trimmed.length < 16) return { ok: false, code: "invalid" };

  const { data, error } = await supabase.rpc(
    "resolve_client_review_by_token" as never,
    { p_token: trimmed } as never
  );
  if (error) return { ok: false, code: "invalid" };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, code: "not_found" };
  const mapped = mapClientReviewRow(row as Parameters<typeof mapClientReviewRow>[0]);
  if (mapped.status === "revoked") return { ok: false, code: "revoked" };
  return { ok: true, review: mapped };
}

export async function loadJourneyReviews(
  supabase: SupabaseClient,
  review: ClientReviewRecord
): Promise<ClientReviewRecord[]> {
  if (!review.journeyId) return [review];
  const { data } = await supabase
    .from("campaign_client_reviews" as never)
    .select("*")
    .eq("journey_id", review.journeyId)
    .neq("status", "revoked")
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as Parameters<typeof mapClientReviewRow>[0][];
  const mapped = rows.map((row) => mapClientReviewRow(row));
  if (!mapped.some((item) => item.id === review.id)) mapped.push(review);
  return mapped;
}

async function markFirstViewed(supabase: SupabaseClient, review: ClientReviewRecord): Promise<ClientReviewRecord> {
  if (review.firstViewedAt || !isInteractiveClientReview(review.status)) return review;
  const now = new Date().toISOString();
  await supabase
    .from("campaign_client_reviews" as never)
    .update({ first_viewed_at: now, updated_at: now } as never)
    .eq("id", review.id)
    .is("first_viewed_at", null);
  return { ...review, firstViewedAt: now };
}

async function loadComments(
  supabase: SupabaseClient,
  reviewIds: string[],
  sourceByReviewId: Record<string, ClientReviewRecord["source"]>
): Promise<ClientComment[]> {
  if (reviewIds.length === 0) return [];
  const { data } = await supabase
    .from("campaign_client_review_comments" as never)
    .select("id, review_id, target_type, target_id, author_kind, author_label, message, status, created_at")
    .in("review_id", reviewIds)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as Array<{
    id: string;
    review_id: string;
    target_type: ClientComment["targetType"];
    target_id: string | null;
    author_kind: ClientComment["authorKind"];
    author_label: string;
    message: string;
    status: ClientComment["status"];
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    authorKind: row.author_kind,
    authorLabel: row.author_label,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    stage: sourceByReviewId[row.review_id],
  }));
}

async function loadActivity(
  supabase: SupabaseClient,
  reviewIds: string[]
): Promise<ClientActivityEvent[]> {
  if (reviewIds.length === 0) return [];
  const { data } = await supabase
    .from("campaign_client_review_events" as never)
    .select("id, event_type, actor_kind, actor_label, payload, created_at")
    .in("review_id", reviewIds)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as Array<{
    id: string;
    event_type: string;
    actor_kind: ClientActivityEvent["actorKind"];
    actor_label: string | null;
    payload: Record<string, unknown> | null;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    actorKind: row.actor_kind,
    actorLabel: row.actor_label,
    summary: eventSummary(row.event_type, row.payload),
    createdAt: row.created_at,
  }));
}

function eventSummary(type: string, payload: Record<string, unknown> | null): string {
  switch (type) {
    case "campaign_sent_for_review":
      return "Campaign sent for review";
    case "creator_selected":
      return `Creator selected${payload?.name ? `: ${payload.name}` : ""}`;
    case "creator_rejected":
      return `Creator rejected${payload?.name ? `: ${payload.name}` : ""}`;
    case "comment_added":
      return "Comment added";
    case "changes_requested":
      return "Changes requested";
    case "version_published":
      return `Version ${payload?.review_number ?? ""} published`.trim();
    case "client_approved":
      return "Client approved";
    case "client_rejected":
      return "Client rejected";
    case "shortlist_approved":
      return "Shortlist approved";
    case "quotation_approved":
      return "Quotation approved";
    case "quotation_revision_published":
      return "Updated quotation sent for approval";
    case "review_viewed":
      return "Client opened this review";
    default:
      return type.replaceAll("_", " ");
  }
}

export async function newerReviewNumberFor(
  supabase: SupabaseClient,
  review: ClientReviewRecord
): Promise<number | null> {
  let query = supabase
    .from("campaign_client_reviews" as never)
    .select("review_number")
    .eq("source", review.source)
    .gt("review_number", review.reviewNumber)
    .neq("status", "revoked")
    .order("review_number", { ascending: false })
    .limit(1);
  if (review.source === "shortlist" && review.shortlistId) {
    query = query.eq("shortlist_id", review.shortlistId);
  } else if (review.source === "quotation" && review.quotationId) {
    query = query.eq("quotation_id", review.quotationId);
  } else if (review.campaignObjectId) {
    query = query.eq("campaign_object_id", review.campaignObjectId);
  } else {
    return null;
  }
  const { data } = await query.maybeSingle();
  const row = data as { review_number?: number } | null;
  return row?.review_number ?? null;
}

function viewFromSnapshot(
  review: ClientReviewRecord,
  snapshot: ClientReviewSourceSnapshot,
  selection: Record<string, ClientCreatorSelectionState>,
  comments: ClientComment[],
  activity: ClientActivityEvent[],
  newer: number | null
): ClientWorkspaceView {
  const commercial = projectCommercialFromSnapshot(snapshot, selection);
  const overview = projectOverviewFromSnapshot(snapshot, commercial);
  const { packageSummary, mediaPlanSummary } = projectClientMediaPlans(snapshot, selection);
  const view: ClientWorkspaceView = {
    review,
    newerReviewNumber: newer,
    overview,
    strategyBody: snapshot.strategyBody,
    creators: applyCreatorForecasts(projectCreatorsFromSnapshot(snapshot, selection), packageSummary),
    content: snapshot.content,
    timeline: snapshot.timeline,
    commercial,
    packageSummary,
    mediaPlanSummary,
    quotation: snapshot.quotation,
    visibleSections: [],
    comments,
    activity,
    canDecide: isInteractiveClientReview(review.status) && !newer,
    clientUpdate: visibleClientUpdateNotice(snapshot.clientUpdate),
  };
  view.visibleSections = visibleClientWorkspaceSections(view);
  return view;
}

export async function loadClientWorkspace(
  token: string,
  requestedReviewId?: string
): Promise<
  | { ok: true; view: ClientWorkspaceView; entry: ClientWorkspaceEntry; campaignObject: CampaignObject | null }
  | { ok: false; code: "invalid" | "revoked" | "not_found" | "unavailable"; message: string }
> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const anon = await createSupabaseServerClient();
  const service = serviceClient();
  const resolver = anon ?? service;
  if (!resolver) {
    return { ok: false, code: "unavailable", message: "Client review is temporarily unavailable." };
  }

  const resolvedInitial = await resolveClientReviewByToken(resolver, token);
  if (!resolvedInitial.ok) {
    return {
      ok: false,
      code: resolvedInitial.code,
      message:
        resolvedInitial.code === "revoked"
          ? "This review link has been revoked."
          : "This review link is invalid or has expired.",
    };
  }

  const db = service ?? resolver;
  let members = await loadJourneyReviews(db, resolvedInitial.review);
  const quotationTip = latestReviewForSource(members, "quotation");
  if (
    service &&
    quotationTip &&
    quotationTip.quotationId &&
    canLiveSyncClientReview({
      status: quotationTip.status,
      source: quotationTip.source,
      campaignHeaderId: quotationTip.campaignHeaderId,
    })
  ) {
    try {
      const { createClientReviewFromQuotation } = await import("./create-from-quotation");
      await createClientReviewFromQuotation(service, {
        quotationId: quotationTip.quotationId,
        userId: "00000000-0000-0000-0000-000000000000",
        origin: process.env.NEXT_PUBLIC_APP_URL ?? "https://dev.thinkwaymedia.com",
        mintMissingShareToken: false,
        syncExistingOnly: true,
      });
      members = await loadJourneyReviews(db, resolvedInitial.review);
    } catch {
      /* keep the stored snapshot if quotation sync is unavailable */
    }
  }

  const canonicalReviewId = journeyCanonicalReviewId(members, resolvedInitial.review.id);
  const picked = pickActiveDecisionReview({
    reviews: members,
    requestedReviewId,
    canonicalReviewId,
    tokenBoundReviewId: resolvedInitial.review.id,
  });
  if (!picked.review) {
    return { ok: false, code: "not_found", message: "This campaign package is no longer available." };
  }

  let activeReview = picked.review;
  if (!picked.historical) {
    activeReview = await markFirstViewed(db, activeReview);
    members = members.map((item) => (item.id === activeReview.id ? activeReview : item));
  }

  const shortlistTip = latestReviewForSource(members, "shortlist");
  const shortlistApproved = latestApprovedReviewForSource(members, "shortlist");
  const quotationLatest = latestReviewForSource(members, "quotation");
  const quotationApprovedPrior = members.some(
    (item) =>
      item.source === "quotation" &&
      item.status === "approved" &&
      quotationLatest != null &&
      item.id !== quotationLatest.id
  );
  const movedToCampaign = Boolean(
    quotationLatest?.campaignHeaderId || members.some((item) => item.campaignHeaderId)
  );
  const shortlistStage = deriveShortlistStage({ review: shortlistTip });
  const quotationStage = deriveQuotationStage({
    quotationExists: Boolean(quotationLatest?.quotationId),
    review: quotationLatest,
    priorApprovedReview: quotationApprovedPrior,
    movedToCampaign,
  });
  const journey: ClientWorkspaceJourney = {
    id: activeReview.journeyId ?? activeReview.id,
    canonicalReviewId,
    memberReviewIds: members.map((item) => item.id),
    shortlistStage,
    quotationStage,
    campaignStarted: movedToCampaign,
    performanceStarted: movedToCampaign,
    invoiceStarted: false,
    campaignHeaderId: activeReview.campaignHeaderId ?? quotationLatest?.campaignHeaderId ?? null,
    quotationId: quotationLatest?.quotationId ?? null,
    shortlistId: shortlistTip?.shortlistId ?? activeReview.shortlistId,
    historical: picked.historical,
    canApproveShortlist:
      !picked.historical && !movedToCampaign && isInteractiveClientReview(shortlistTip?.status ?? "revoked"),
    canApproveQuotation:
      !picked.historical &&
      !movedToCampaign &&
      isInteractiveClientReview(quotationLatest?.status ?? "revoked"),
    canRequestShortlistChanges:
      !picked.historical && isInteractiveClientReview(shortlistTip?.status ?? "revoked"),
    canRequestQuotationChanges:
      !picked.historical &&
      !movedToCampaign &&
      isInteractiveClientReview(quotationLatest?.status ?? "revoked"),
    canRejectQuotation:
      !picked.historical &&
      !movedToCampaign &&
      isInteractiveClientReview(quotationLatest?.status ?? "revoked"),
    movedToCampaign,
  };

  const sourceByReviewId = Object.fromEntries(members.map((item) => [item.id, item.source]));
  const reviewIds = members.map((item) => item.id);
  const [comments, activity, newer] = await Promise.all([
    loadComments(db, reviewIds, sourceByReviewId),
    loadActivity(db, reviewIds),
    newerReviewNumberFor(db, activeReview),
  ]);

  const selection = activeReview.selectionState as Record<string, ClientCreatorSelectionState>;
  let view: ClientWorkspaceView | null = null;
  let campaignObject: CampaignObject | null = null;

  if (activeReview.sourceSnapshot) {
    view = viewFromSnapshot(
      activeReview,
      activeReview.sourceSnapshot,
      selection,
      comments,
      activity,
      newer
    );
  } else if (activeReview.campaignObjectId) {
    const loaded = await CampaignObjectPersistenceService.loadVersion(
      db as never,
      activeReview.campaignObjectId,
      activeReview.frozenVersion
    );
    if (!loaded?.campaignObject) {
      return { ok: false, code: "not_found", message: "This campaign package is no longer available." };
    }
    campaignObject = loaded.campaignObject;
    let hydrated: Awaited<ReturnType<typeof hydrateSlateCreators>> = [];
    try {
      hydrated = await hydrateSlateCreators(db as never, campaignObject);
    } catch {
      hydrated = [];
    }
    const snapshot = snapshotFromCampaignObject(campaignObject, selection, hydrated);
    view = viewFromSnapshot(activeReview, snapshot, selection, comments, activity, newer);
    view.content = projectClientContent(campaignObject);
    view.timeline = projectClientTimeline(campaignObject);
    view.commercial = projectClientCommercial(campaignObject, selection);
    view.overview = projectClientOverview(campaignObject, selection);
    const plans = projectClientMediaPlans(snapshot, selection);
    view.packageSummary = plans.packageSummary;
    view.mediaPlanSummary = plans.mediaPlanSummary;
    view.creators = applyCreatorForecasts(
      projectClientCreators(campaignObject, selection, hydrated),
      plans.packageSummary
    );
    view.visibleSections = visibleClientWorkspaceSections(view);
  }

  if (!view) {
    return { ok: false, code: "not_found", message: "This campaign package is no longer available." };
  }

  view.journey = journey;
  view.stageDiff =
    shortlistApproved?.status === "approved"
      ? diffShortlistToQuotation(shortlistApproved.sourceSnapshot, quotationLatest?.sourceSnapshot)
      : null;
  view.canDecide =
    !picked.historical &&
    (journey.canApproveShortlist || journey.canApproveQuotation) &&
    !newer;

  const entry: ClientWorkspaceEntry = {
    brandName: view.overview.brandName,
    campaignName: view.overview.campaignName,
    clientLabel: view.overview.clientLabel,
    reviewNumber: activeReview.reviewNumber,
    status: activeReview.status,
    statusLabel: journeyActionRequired({
      shortlistStage,
      quotationStage,
      historical: picked.historical,
    }),
    lastUpdated: activeReview.updatedAt,
    actionRequired: journeyActionRequired({
      shortlistStage,
      quotationStage,
      historical: picked.historical,
    }),
  };

  return { ok: true, view, entry, campaignObject };
}

export async function loadLatestInternalReview(
  supabase: SupabaseClient,
  campaignObjectId: string
): Promise<ClientReviewRecord | null> {
  const { data } = await supabase
    .from("campaign_client_reviews" as never)
    .select("*")
    .eq("campaign_object_id", campaignObjectId)
    .order("review_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return mapClientReviewRow(data as Parameters<typeof mapClientReviewRow>[0]);
}

export async function loadLatestInternalReviewForQuotation(
  supabase: SupabaseClient,
  quotationId: string
): Promise<ClientReviewRecord | null> {
  const { data } = await supabase
    .from("campaign_client_reviews" as never)
    .select("*")
    .eq("quotation_id", quotationId)
    .order("review_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return mapClientReviewRow(data as Parameters<typeof mapClientReviewRow>[0]);
}
