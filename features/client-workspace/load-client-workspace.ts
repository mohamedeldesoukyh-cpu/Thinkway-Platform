import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { hydrateSlateCreators } from "@/features/campaign-studio/services/copilot/slate-edit-mutations";
import { loadClientWorkspaceDisplayFlags } from "@/lib/commercial/client-original-currency-persist";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { type ClientCreatorSelectionState } from "./constants";
import { mapClientReviewRow, type ReviewRow } from "./persist-client-review";
import { hashClientReviewToken } from "./security/review-token";
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
  canLiveSyncClientRoster,
  journeyActionRequired,
  journeyCanonicalReviewId,
  latestApprovedReviewForSource,
  latestReviewForSource,
  pickActiveDecisionReview,
  projectClientJourney,
} from "./journey-state";
import { applyLiveCreatorRoster } from "./selection-flow";
import { diffShortlistToQuotation } from "./snapshot-diff";
import type {
  ClientActivityEvent,
  ClientComment,
  ClientReviewRecord,
  ClientReviewSourceSnapshot,
  ClientWorkspaceEntry,
  ClientWorkspaceView,
} from "./types";
import { visibleClientWorkspaceSections } from "./visible-sections";
import { loadSavedClientEmailsForQuotation } from "./client-quotation-delivery";
import { emptyClientCampaignExecution } from "./campaign-execution";
import { emptyClientCampaignContent } from "./content-approval";
import { loadClientCampaignContent } from "./load-campaign-content";
import { loadClientCampaignExecution } from "./load-campaign-execution";
import { loadIdentityLogoForReview, headerPartnerIdentity } from "./identity-logo";
import { applyEntitlementToView, clientWorkspaceEntitlementBlock, isClientWorkspaceSectionOpen } from "./entitlement";
import { loadEntitlementForReview } from "./load-entitlement";
import {
  isSelectionConfirmed,
  mergeSnapshotsForClientView,
  hydrateClientSelection,
  isPricedClientInvestment,
  resolveClientSelectionFreeze,
  selectionCalculator,
  selectionJourneyFlags,
} from "./selection-flow";
import {
  hydrateSnapshotCreatorsFromCrm,
  hydrateSnapshotCreatorsFromUnified,
} from "./creator-snapshot";

export type ResolvedClientReview =
  | { ok: true; review: ClientReviewRecord }
  | { ok: false; code: "invalid" | "revoked" | "not_found" };

export type ResolvedClientReviewForPage =
  | { ok: true; review: ClientReviewRecord; linkExpired: boolean }
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

async function loadReviewRowById(
  supabase: SupabaseClient,
  reviewId: string
): Promise<ClientReviewRecord | null> {
  const { data } = await supabase
    .from("campaign_client_reviews" as never)
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();
  if (!data) return null;
  return mapClientReviewRow(data as ReviewRow);
}

/** Page load may reconstruct a stopped link so the workspace can render dimmed. Mutations still use the live RPC. */
export async function resolveClientReviewByTokenForPage(
  supabase: SupabaseClient,
  token: string
): Promise<ResolvedClientReviewForPage> {
  const live = await resolveClientReviewByToken(supabase, token);
  if (live.ok) return { ok: true, review: live.review, linkExpired: false };
  if (live.code === "invalid") return live;

  const trimmed = token.trim();
  if (trimmed.length < 16) return { ok: false, code: "invalid" };
  let hash: string;
  try {
    hash = hashClientReviewToken(trimmed);
  } catch {
    return { ok: false, code: "invalid" };
  }

  const { data: journey } = await supabase
    .from("campaign_client_journeys" as never)
    .select("id, landing_review_id")
    .eq("token_hash", hash)
    .maybeSingle();
  const journeyRow = journey as { id: string; landing_review_id?: string | null } | null;
  if (journeyRow?.landing_review_id) {
    const landing = await loadReviewRowById(supabase, journeyRow.landing_review_id);
    if (landing) {
      return { ok: true, review: landing, linkExpired: landing.status === "revoked" };
    }
  }
  if (journeyRow?.id) {
    const { data: journeyReview } = await supabase
      .from("campaign_client_reviews" as never)
      .select("*")
      .eq("journey_id", journeyRow.id)
      .order("review_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (journeyReview) {
      const mapped = mapClientReviewRow(journeyReview as ReviewRow);
      return { ok: true, review: mapped, linkExpired: mapped.status === "revoked" };
    }
  }

  const { data: hashedReview } = await supabase
    .from("campaign_client_reviews" as never)
    .select("*")
    .eq("token_hash", hash)
    .order("review_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (hashedReview) {
    const mapped = mapClientReviewRow(hashedReview as ReviewRow);
    return { ok: true, review: mapped, linkExpired: mapped.status === "revoked" };
  }

  return live;
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
    case "creators_confirmed":
      return "Creators approved";
    case "quotation_revision_published":
      return "Updated quotation sent for approval";
    case "review_viewed":
      return "Client opened this review";
    case "link_revoked":
      return "Client Workspace link stopped";
    case "link_restored":
      return "Client Workspace link turned on again";
    case "access_requested":
      return "Client requested access to an expired workspace link";
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
    identityLogo: snapshot.identityLogo ?? null,
  };
  view.visibleSections = visibleClientWorkspaceSections(view);
  return view;
}

export async function loadClientWorkspace(
  token: string,
  requestedReviewId?: string
): Promise<
  | { ok: true; view: ClientWorkspaceView; entry: ClientWorkspaceEntry; campaignObject: CampaignObject | null }
  | { ok: false; code: "invalid" | "revoked" | "not_found" | "unavailable" | "workspace_off" | "workspace_unavailable"; message: string }
> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const anon = await createSupabaseServerClient();
  const service = serviceClient();
  const resolver = anon ?? service;
  if (!resolver) {
    return { ok: false, code: "unavailable", message: "Client review is temporarily unavailable." };
  }

  const resolvedInitial = await resolveClientReviewByTokenForPage(resolver, token);
  if (!resolvedInitial.ok) {
    return {
      ok: false,
      code: resolvedInitial.code,
      message: "This review link is invalid or has expired.",
    };
  }
  const linkExpired = resolvedInitial.linkExpired;

  const db = service ?? resolver;
  const earlyEntitlement = await loadEntitlementForReview(db as never, resolvedInitial.review);
  const earlyBlock = clientWorkspaceEntitlementBlock(
    earlyEntitlement.clientId,
    earlyEntitlement.entitlement
  );
  if (earlyBlock) {
    return { ok: false, code: earlyBlock.code, message: earlyBlock.message };
  }

  let members = await loadJourneyReviews(db, resolvedInitial.review);
  const canonicalReviewId = journeyCanonicalReviewId(members, resolvedInitial.review.id);
  let picked = pickActiveDecisionReview({
    reviews: members,
    requestedReviewId,
    canonicalReviewId,
    tokenBoundReviewId: resolvedInitial.review.id,
  });
  if (linkExpired) {
    picked = { review: resolvedInitial.review, historical: true };
  }
  const quotationTip = latestReviewForSource(members, "quotation");
  const shortlistTip = latestReviewForSource(members, "shortlist");
  if (service && !picked.historical && !linkExpired) {
    try {
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://dev.thinkwaymedia.com";
      const systemUserId = "00000000-0000-0000-0000-000000000000";
      const shortlistId = shortlistTip?.shortlistId ?? picked.review?.shortlistId ?? null;
      if (
        shortlistId &&
        shortlistTip &&
        canLiveSyncClientRoster({
          status: shortlistTip.status,
          campaignHeaderId: shortlistTip.campaignHeaderId,
        })
      ) {
        const { createClientReviewFromShortlist } = await import("./create-from-shortlist");
        await createClientReviewFromShortlist(service, {
          shortlistId,
          userId: systemUserId,
          origin,
          mintMissingShareToken: false,
          syncExistingOnly: true,
        });
      }
      const { resolveCurrentQuotationIdForClientJourney } = await import("./live-quotation-projection");
      const liveQuotationId = await resolveCurrentQuotationIdForClientJourney(service, {
        quotationId: quotationTip?.quotationId ?? picked.review?.quotationId ?? null,
        shortlistId,
      });
      if (
        liveQuotationId &&
        quotationTip &&
        canLiveSyncClientReview({
          status: quotationTip.status,
          source: quotationTip.source,
          campaignHeaderId: quotationTip.campaignHeaderId,
        })
      ) {
        const { createClientReviewFromQuotation } = await import("./create-from-quotation");
        await createClientReviewFromQuotation(service, {
          quotationId: liveQuotationId,
          userId: systemUserId,
          origin,
          mintMissingShareToken: false,
          syncExistingOnly: true,
        });
      }
      members = await loadJourneyReviews(db, resolvedInitial.review);
      picked = pickActiveDecisionReview({
        reviews: members,
        requestedReviewId,
        canonicalReviewId: journeyCanonicalReviewId(members, resolvedInitial.review.id),
        tokenBoundReviewId: resolvedInitial.review.id,
      });
    } catch {
      /* keep the stored snapshot if live roster sync is unavailable */
    }
  }

  if (!picked.review) {
    return { ok: false, code: "not_found", message: "This campaign package is no longer available." };
  }

  let activeReview = picked.review;
  if (!picked.historical && !linkExpired) {
    activeReview = await markFirstViewed(db, activeReview);
    members = members.map((item) => (item.id === activeReview.id ? activeReview : item));
  }

  const shortlistApproved = latestApprovedReviewForSource(members, "shortlist");
  const quotationLatest = latestReviewForSource(members, "quotation");
  const journey = projectClientJourney({
    members,
    viewed: activeReview,
    historical: picked.historical,
    canonicalReviewId: journeyCanonicalReviewId(members, resolvedInitial.review.id),
  });

  const sourceByReviewId = Object.fromEntries(members.map((item) => [item.id, item.source]));
  const reviewIds = members.map((item) => item.id);
  const [comments, activity, newer] = await Promise.all([
    loadComments(db, reviewIds, sourceByReviewId),
    loadActivity(db, reviewIds),
    newerReviewNumberFor(db, activeReview),
  ]);

  const shortlistSnapshot = latestReviewForSource(members, "shortlist")?.sourceSnapshot ?? null;
  const quotationSnapshot = quotationLatest?.sourceSnapshot ?? null;
  let view: ClientWorkspaceView | null = null;
  let campaignObject: CampaignObject | null = null;
  let selection = activeReview.selectionState as Record<string, ClientCreatorSelectionState>;
  let clientSelectionFreeze = activeReview.sourceSnapshot?.clientSelection
    ?? quotationSnapshot?.clientSelection
    ?? shortlistSnapshot?.clientSelection;

  if (activeReview.sourceSnapshot) {
    let mergedSnapshot = mergeSnapshotsForClientView({
      active: activeReview.sourceSnapshot,
      shortlist: shortlistSnapshot,
      quotation: quotationSnapshot,
      historical: picked.historical,
    });
    const canHydrateLiveProfile =
      !picked.historical &&
      Boolean(service) &&
      isInteractiveClientReview(activeReview.status) &&
      !activeReview.campaignHeaderId;
    let liveQuotationId: string | null = null;
    if (!picked.historical && service) {
      try {
        const {
          projectCurrentQuotationOntoSnapshot,
          resolveCurrentQuotationIdForClientJourney,
        } = await import("./live-quotation-projection");
        liveQuotationId = await resolveCurrentQuotationIdForClientJourney(service, {
          quotationId: quotationLatest?.quotationId ?? activeReview.quotationId,
          shortlistId: canHydrateLiveProfile
            ? latestReviewForSource(members, "shortlist")?.shortlistId ?? activeReview.shortlistId
            : null,
        });
        if (liveQuotationId) {
          const projected = await projectCurrentQuotationOntoSnapshot(
            service,
            mergedSnapshot,
            liveQuotationId
          );
          if (projected) mergedSnapshot = projected;
        }
      } catch {
        /* keep the merged snapshot if quotation SSOT is unavailable */
      }
    }
    if (!picked.historical && service && canHydrateLiveProfile) {
      try {
        const shortlistId =
          latestReviewForSource(members, "shortlist")?.shortlistId ?? activeReview.shortlistId;
        if (shortlistId) {
          const { loadShortlistPoolCreators } = await import("./create-from-shortlist");
          const livePool = await loadShortlistPoolCreators(service, shortlistId);
          if (livePool) {
            const liveQuoted = mergedSnapshot.creators.filter((creator) => creator.quotationEligible);
            mergedSnapshot = applyLiveCreatorRoster(mergedSnapshot, livePool, liveQuoted);
          }
        }
      } catch {
        /* keep the merged snapshot if live shortlist membership is unavailable */
      }
    }
    if (canHydrateLiveProfile && service) {
      try {
        mergedSnapshot = await hydrateSnapshotCreatorsFromCrm(service, mergedSnapshot);
        mergedSnapshot = await hydrateSnapshotCreatorsFromUnified(service, mergedSnapshot);
      } catch {
        /* keep commercial overlay if live creator lookup fails */
      }
      try {
        const { persistInteractiveReviewProjection } = await import("./live-quotation-projection");
        await persistInteractiveReviewProjection({
          supabase: service,
          review: activeReview,
          snapshot: mergedSnapshot,
          previousFingerprint: activeReview.packageFingerprint as Record<string, unknown>,
          quotationId: liveQuotationId ?? activeReview.quotationId,
        });
      } catch {
        /* in-memory hydrate still renders even if snapshot persist fails */
      }
    }
    const resolvedFreeze = resolveClientSelectionFreeze(
      mergedSnapshot.clientSelection,
      mergedSnapshot.creators
    );
    if (resolvedFreeze?.didUpgrade) {
      mergedSnapshot = { ...mergedSnapshot, clientSelection: resolvedFreeze.freeze };
      clientSelectionFreeze = resolvedFreeze.freeze;
      if (service && !picked.historical && !activeReview.campaignHeaderId) {
        await service
          .from("campaign_client_reviews" as never)
          .update({ source_snapshot: mergedSnapshot, updated_at: new Date().toISOString() } as never)
          .eq("id", activeReview.id);
      }
    }
    selection = hydrateClientSelection(
      mergedSnapshot.creators,
      selection,
      resolvedFreeze?.lockedSelectionIds ?? mergedSnapshot.clientSelection?.creatorIds,
      resolvedFreeze?.pendingCommercialApprovalIds
    );
    view = viewFromSnapshot(
      activeReview,
      mergedSnapshot,
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
    const resolvedFreeze = resolveClientSelectionFreeze(snapshot.clientSelection, snapshot.creators);
    const freezeSnapshotForHydrate = resolvedFreeze
      ? { ...snapshot, clientSelection: resolvedFreeze.freeze }
      : snapshot;
    selection = hydrateClientSelection(
      freezeSnapshotForHydrate.creators,
      selection,
      resolvedFreeze?.lockedSelectionIds ?? snapshot.clientSelection?.creatorIds,
      resolvedFreeze?.pendingCommercialApprovalIds
    );
    if (resolvedFreeze) clientSelectionFreeze = resolvedFreeze.freeze;
    view = viewFromSnapshot(activeReview, freezeSnapshotForHydrate, selection, comments, activity, newer);
    view.content = projectClientContent(campaignObject);
    view.timeline = projectClientTimeline(campaignObject);
    view.commercial = projectClientCommercial(campaignObject, selection);
    view.overview = projectClientOverview(campaignObject, selection);
    const plans = projectClientMediaPlans(freezeSnapshotForHydrate, selection);
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

  const resolvedForFlags = resolveClientSelectionFreeze(clientSelectionFreeze, view.creators);
  const calc = selectionCalculator(view.creators, selection);
  const confirmed = isSelectionConfirmed(
    clientSelectionFreeze ? { clientSelection: clientSelectionFreeze } : null
  );
  const pendingIds = resolvedForFlags?.pendingCommercialApprovalIds ?? [];
  const pendingSelectedCount = pendingIds.filter((id) => selection[id] === "accepted").length;
  const includedPricedCount = resolvedForFlags
    ? resolvedForFlags.commerciallyIncludedCreatorIds.filter((id) => {
        const creator = view!.creators.find((item) => item.creatorId === id);
        return Boolean(creator && isPricedClientInvestment(creator.investmentAmount));
      }).length
    : calc.pricedSelectedCount;
  const flags = selectionJourneyFlags({
    historical: picked.historical,
    interactive:
      (isInteractiveClientReview(activeReview.status) || pendingIds.length > 0) && !picked.historical,
    quotationInteractive: journey.canApproveQuotation,
    selectionConfirmed: confirmed,
    selectedCount: resolvedForFlags ? includedPricedCount : calc.selectedCount,
    unpricedSelectedCount: resolvedForFlags ? 0 : calc.unpricedSelectedCount,
    approvedQuotationCount: journey.approvedQuotationCount ?? 0,
    clientApprovedCreatorIds: clientSelectionFreeze?.creatorIds,
    pendingSelectedCount,
    commerciallyIncludedCreatorIds: resolvedForFlags?.commerciallyIncludedCreatorIds,
    pendingCommercialApprovalCreatorIds: pendingIds,
    quotationExtensionCount: resolvedForFlags?.extensionWaves.length ?? 0,
  });
  view.journey = { ...journey, ...flags, clientSelection: clientSelectionFreeze };
  view.visibleSections = visibleClientWorkspaceSections(view);
  const entitlementForView = await loadEntitlementForReview(db as never, {
    quotationId: view.journey.quotationId ?? activeReview.quotationId,
    shortlistId: view.journey.shortlistId ?? activeReview.shortlistId,
    campaignHeaderId: view.journey.campaignHeaderId ?? activeReview.campaignHeaderId,
    clientLabel:
      view.overview.clientLabel ||
      activeReview.clientLabel ||
      activeReview.sourceSnapshot?.clientLabel ||
      null,
    brandName: view.overview.brandName || activeReview.brandName || null,
    campaignName: view.overview.campaignName || activeReview.campaignName || null,
    sourceSnapshot: activeReview.sourceSnapshot,
  });
  const entitlementBlock = clientWorkspaceEntitlementBlock(
    entitlementForView.clientId,
    entitlementForView.entitlement
  );
  if (entitlementBlock) {
    return { ok: false, code: entitlementBlock.code, message: entitlementBlock.message };
  }
  const campaignOpen = isClientWorkspaceSectionOpen(entitlementForView.entitlement, "approval");
  const commercialOpen = isClientWorkspaceSectionOpen(entitlementForView.entitlement, "commercial");
  view.campaignExecution =
    picked.historical || !campaignOpen
      ? emptyClientCampaignExecution()
      : await loadClientCampaignExecution((service ?? db) as never, view.journey.campaignHeaderId);
  view.campaignContent =
    picked.historical || !campaignOpen
      ? emptyClientCampaignContent()
      : await loadClientCampaignContent((service ?? db) as never, view.journey.campaignHeaderId);
  view.clientEmails = commercialOpen
    ? await loadSavedClientEmailsForQuotation(
        (service ?? db) as never,
        view.journey.quotationId
      )
    : [];
  view.stageDiff =
    picked.historical || shortlistApproved?.status !== "approved"
      ? null
      : diffShortlistToQuotation(shortlistApproved.sourceSnapshot, quotationLatest?.sourceSnapshot);
  view.canDecide =
    !linkExpired &&
    !picked.historical &&
    !newer &&
    (journey.canApproveShortlist || journey.canApproveQuotation || pendingIds.length > 0);
  view.linkExpired = linkExpired;
  view.showOriginalCurrency = false;
  view.hideCostAndFees = false;
  if (!picked.historical && commercialOpen) {
    try {
      const flags = await loadClientWorkspaceDisplayFlags((service ?? db) as never, {
        quotationId: view.journey?.quotationId ?? activeReview.quotationId,
        shortlistId: view.journey?.shortlistId ?? activeReview.shortlistId,
      });
      view.showOriginalCurrency = flags.showOriginalCurrency;
      view.hideCostAndFees = flags.hideCostAndFees;
    } catch {
      view.showOriginalCurrency = false;
      view.hideCostAndFees = false;
    }
  }

  try {
    const liveLogo = await loadIdentityLogoForReview(service ?? db, {
      quotationId: view.journey?.quotationId ?? activeReview.quotationId,
      shortlistId: view.journey?.shortlistId ?? activeReview.shortlistId,
      campaignHeaderId: view.journey?.campaignHeaderId ?? activeReview.campaignHeaderId,
      clientLabel:
        view.overview.clientLabel ||
        activeReview.clientLabel ||
        activeReview.sourceSnapshot?.clientLabel,
      brandName: view.overview.brandName,
      campaignName: view.overview.campaignName,
    });
    view.identityLogo = liveLogo ?? view.identityLogo ?? null;
  } catch {
    /* keep frozen snapshot logo if live identity lookup fails */
  }
  view.identityLogo = headerPartnerIdentity({
    identityLogo: view.identityLogo,
    clientLabel:
      view.overview.clientLabel ||
      activeReview.clientLabel ||
      activeReview.sourceSnapshot?.clientLabel,
    brandName: view.overview.brandName,
    campaignName: view.overview.campaignName,
  });

  const entry: ClientWorkspaceEntry = {
    brandName: view.overview.brandName,
    campaignName: view.overview.campaignName,
    clientLabel: view.overview.clientLabel,
    reviewNumber: activeReview.reviewNumber,
    status: activeReview.status,
    statusLabel: journeyActionRequired({
      shortlistStage: view.journey.shortlistStage,
      quotationStage: view.journey.quotationStage,
      historical: view.journey.historical,
      selectionConfirmed: view.journey.selectionConfirmed,
      canConfirmCreators: view.journey.canConfirmCreators,
      canApproveFinalQuotation: view.journey.canApproveFinalQuotation,
      selectedCount: calc.selectedCount,
    }),
    lastUpdated: activeReview.updatedAt,
    actionRequired: journeyActionRequired({
      shortlistStage: view.journey.shortlistStage,
      quotationStage: view.journey.quotationStage,
      historical: view.journey.historical,
      selectionConfirmed: view.journey.selectionConfirmed,
      canConfirmCreators: view.journey.canConfirmCreators,
      canApproveFinalQuotation: view.journey.canApproveFinalQuotation,
      selectedCount: calc.selectedCount,
    }),
    identityLogo: view.identityLogo ?? null,
  };

  view = applyEntitlementToView(view, entitlementForView.entitlement);
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
