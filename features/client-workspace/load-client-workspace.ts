import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { hydrateSlateCreators } from "@/features/campaign-studio/services/copilot/slate-edit-mutations";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { CLIENT_STATUS_LABEL, type ClientCreatorSelectionState } from "./constants";
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
} from "./snapshot";
import { projectMediaPlanSummary } from "./media-plan-summary";
import { snapshotFromCampaignObject } from "./snapshot-from-object";
import { actionRequiredFor, isInteractiveClientReview } from "./status";
import type {
  ClientActivityEvent,
  ClientComment,
  ClientReviewRecord,
  ClientReviewSourceSnapshot,
  ClientWorkspaceEntry,
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

async function loadComments(
  supabase: SupabaseClient,
  reviewId: string
): Promise<ClientComment[]> {
  const { data } = await supabase
    .from("campaign_client_review_comments" as never)
    .select("id, target_type, target_id, author_kind, author_label, message, status, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as Array<{
    id: string;
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
  }));
}

async function loadActivity(
  supabase: SupabaseClient,
  reviewId: string
): Promise<ClientActivityEvent[]> {
  const { data } = await supabase
    .from("campaign_client_review_events" as never)
    .select("id, event_type, actor_kind, actor_label, payload, created_at")
    .eq("review_id", reviewId)
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
    case "quotation_generated":
      return "Quotation generated";
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
  const view: ClientWorkspaceView = {
    review,
    newerReviewNumber: newer,
    overview,
    strategyBody: snapshot.strategyBody,
    creators: projectCreatorsFromSnapshot(snapshot, selection),
    content: snapshot.content,
    timeline: snapshot.timeline,
    commercial,
    mediaPlanSummary: projectMediaPlanSummary(snapshot, selection),
    quotation: snapshot.quotation,
    visibleSections: [],
    comments,
    activity,
    canDecide: isInteractiveClientReview(review.status) && !newer,
  };
  view.visibleSections = visibleClientWorkspaceSections(view);
  return view;
}

export async function loadClientWorkspace(
  token: string
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

  const resolved = await resolveClientReviewByToken(resolver, token);
  if (!resolved.ok) {
    return {
      ok: false,
      code: resolved.code,
      message:
        resolved.code === "revoked"
          ? "This review link has been revoked."
          : "This review link is invalid or has expired.",
    };
  }

  const db = service ?? resolver;
  const selection = resolved.review.selectionState as Record<string, ClientCreatorSelectionState>;
  const [comments, activity, newer] = await Promise.all([
    loadComments(db, resolved.review.id),
    loadActivity(db, resolved.review.id),
    newerReviewNumberFor(db, resolved.review),
  ]);

  let view: ClientWorkspaceView | null = null;
  let campaignObject: CampaignObject | null = null;

  if (resolved.review.sourceSnapshot) {
    view = viewFromSnapshot(
      resolved.review,
      resolved.review.sourceSnapshot,
      selection,
      comments,
      activity,
      newer
    );
  } else if (resolved.review.campaignObjectId) {
    const loaded = await CampaignObjectPersistenceService.loadVersion(
      db as never,
      resolved.review.campaignObjectId,
      resolved.review.frozenVersion
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
    view = viewFromSnapshot(resolved.review, snapshot, selection, comments, activity, newer);
    view.creators = projectClientCreators(campaignObject, selection, hydrated);
    view.content = projectClientContent(campaignObject);
    view.timeline = projectClientTimeline(campaignObject);
    view.commercial = projectClientCommercial(campaignObject, selection);
    view.overview = projectClientOverview(campaignObject, selection);
    view.mediaPlanSummary = projectMediaPlanSummary(snapshot, selection);
    view.visibleSections = visibleClientWorkspaceSections(view);
  }

  if (!view) {
    return { ok: false, code: "not_found", message: "This campaign package is no longer available." };
  }

  const entry: ClientWorkspaceEntry = {
    brandName: view.overview.brandName,
    campaignName: view.overview.campaignName,
    clientLabel: view.overview.clientLabel,
    reviewNumber: resolved.review.reviewNumber,
    status: resolved.review.status,
    statusLabel: newer
      ? "New version requires review"
      : CLIENT_STATUS_LABEL[resolved.review.status],
    lastUpdated: resolved.review.updatedAt,
    actionRequired: actionRequiredFor(resolved.review.status, Boolean(newer)),
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
