import { logAuditEvent } from "@/lib/audit/log-audit-event";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

import {
  CLIENT_REVIEW_LINK_MISSING_MESSAGE,
  type ClientCreatorSelectionState,
  type ClientReviewSource,
  type ClientReviewStatus,
} from "./constants";
import { isReusableClientReviewTip } from "./status";
import { clientSelectionsEqual, mergePersistedClientSelection } from "./client-review-selection";
import { parseSourceSnapshot } from "./snapshot";
import { diffClientReviewSnapshots, retainCreatorBriefs } from "./snapshot-diff";
import { buildClientReviewPath, hashClientReviewToken } from "./security/review-token";
import type { ClientReviewRecord, ClientReviewSourceSnapshot } from "./types";

export type CreateClientReviewResult =
  | {
      ok: true;
      reviewId: string;
      reviewNumber: number;
      frozenVersion: number;
      url: string;
      token: string;
      status: ClientReviewStatus;
      source: ClientReviewSource;
      updates?: string[];
    }
  | { ok: false; message: string; blockers: string[] };

export type ReviewRow = {
  id: string;
  campaign_object_id: string | null;
  frozen_version: number;
  review_number: number;
  status: ClientReviewStatus;
  source?: ClientReviewSource | null;
  client_label: string | null;
  brand_name: string | null;
  campaign_name: string | null;
  conversation_id: string | null;
  campaign_header_id: string | null;
  shortlist_id: string | null;
  quotation_id?: string | null;
  source_snapshot?: ClientReviewSourceSnapshot | Record<string, unknown> | null;
  package_fingerprint: Record<string, unknown>;
  selection_state: Record<string, ClientCreatorSelectionState>;
  share_token?: string | null;
  approved_creator_ids: string[] | null;
  approved_commercial: ClientReviewRecord["approvedCommercial"];
  approved_at: string | null;
  approved_by_label: string | null;
  change_request_summary: string | null;
  change_request_areas: string[] | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
  journey_id?: string | null;
  first_viewed_at?: string | null;
};

export function mapClientReviewRow(row: ReviewRow): ClientReviewRecord {
  return {
    id: row.id,
    campaignObjectId: row.campaign_object_id,
    frozenVersion: row.frozen_version ?? 0,
    reviewNumber: row.review_number,
    status: row.status,
    source: row.source === "shortlist" || row.source === "quotation" ? row.source : "studio",
    clientLabel: row.client_label,
    brandName: row.brand_name,
    campaignName: row.campaign_name,
    conversationId: row.conversation_id,
    campaignHeaderId: row.campaign_header_id,
    shortlistId: row.shortlist_id,
    quotationId: row.quotation_id ?? null,
    sourceSnapshot: parseSourceSnapshot(row.source_snapshot),
    packageFingerprint: row.package_fingerprint ?? {},
    selectionState: row.selection_state ?? {},
    approvedCreatorIds: row.approved_creator_ids,
    approvedCommercial: row.approved_commercial,
    approvedAt: row.approved_at,
    approvedByLabel: row.approved_by_label,
    changeRequestSummary: row.change_request_summary,
    changeRequestAreas: (row.change_request_areas ?? []) as ClientReviewRecord["changeRequestAreas"],
    supersededBy: row.superseded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    journeyId: row.journey_id ?? null,
    firstViewedAt: row.first_viewed_at ?? null,
  };
}

export type ReviewScope =
  | { source: "studio"; campaignObjectId: string }
  | { source: "shortlist"; shortlistId: string }
  | { source: "quotation"; quotationId: string };

export function applyReviewScope<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  scope: ReviewScope
): T {
  if (scope.source === "studio") return query.eq("campaign_object_id", scope.campaignObjectId);
  if (scope.source === "shortlist") return query.eq("shortlist_id", scope.shortlistId);
  return query.eq("quotation_id", scope.quotationId);
}

function fingerprintsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

type ExistingReviewTip = {
  id: string;
  review_number: number;
  status: ClientReviewStatus;
  package_fingerprint: Record<string, unknown> | null;
  source_snapshot?: ClientReviewSourceSnapshot | Record<string, unknown> | null;
  selection_state?: Record<string, ClientCreatorSelectionState> | null;
  share_token?: string | null;
  token_hash?: string | null;
  journey_id?: string | null;
};

type JourneyRow = {
  id: string;
  share_token: string | null;
  landing_review_id: string | null;
  shortlist_id: string | null;
  quotation_id: string | null;
};

function canonicalShareUrl(origin: string, reviewId: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${buildClientReviewPath(reviewId, token)}`;
}

async function loadJourney(
  supabase: SupabaseClient,
  journeyId: string
): Promise<JourneyRow | null> {
  const { data } = await supabase
    .from("campaign_client_journeys" as never)
    .select("id, share_token, landing_review_id, shortlist_id, quotation_id")
    .eq("id", journeyId)
    .maybeSingle();
  return (data as JourneyRow | null) ?? null;
}

async function findJourneyForScope(
  supabase: SupabaseClient,
  input: Pick<PersistClientReviewInput, "shortlistId" | "quotationId" | "campaignHeaderId" | "source">
): Promise<JourneyRow | null> {
  if (input.shortlistId) {
    const { data } = await supabase
      .from("campaign_client_journeys" as never)
      .select("id, share_token, landing_review_id, shortlist_id, quotation_id")
      .eq("shortlist_id", input.shortlistId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) return data as JourneyRow;
  }
  const quotationIds = [input.quotationId].filter((value): value is string => Boolean(value));
  if (input.quotationId) {
    const { data: quote } = await supabase
      .from("quotations")
      .select("id, parent_quotation_id")
      .eq("id", input.quotationId)
      .maybeSingle();
    const parentId = (quote as { parent_quotation_id?: string | null } | null)?.parent_quotation_id;
    if (parentId) quotationIds.push(parentId);
  }
  for (const quotationId of quotationIds) {
    const { data } = await supabase
      .from("campaign_client_journeys" as never)
      .select("id, share_token, landing_review_id, shortlist_id, quotation_id")
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) return data as JourneyRow;
  }
  return null;
}

async function createJourney(
  supabase: SupabaseClient,
  input: {
    token: string;
    shortlistId?: string | null;
    quotationId?: string | null;
    campaignHeaderId?: string | null;
  }
): Promise<JourneyRow | null> {
  const { data, error } = await supabase
    .from("campaign_client_journeys" as never)
    .insert({
      token_hash: hashClientReviewToken(input.token),
      share_token: input.token,
      shortlist_id: input.shortlistId ?? null,
      quotation_id: input.quotationId ?? null,
      campaign_header_id: input.campaignHeaderId ?? null,
    } as never)
    .select("id, share_token, landing_review_id, shortlist_id, quotation_id")
    .single();
  if (error || !data) return null;
  return data as JourneyRow;
}

async function shareFromJourneyOrReview(
  supabase: SupabaseClient,
  origin: string,
  review: { id: string; journeyId?: string | null },
  fallbackToken: string
): Promise<{ url: string; token: string; reviewId: string }> {
  if (review.journeyId) {
    const journey = await loadJourney(supabase, review.journeyId);
    const token = journey?.share_token?.trim() || fallbackToken;
    const reviewId = journey?.landing_review_id || review.id;
    if (token) return { url: canonicalShareUrl(origin, reviewId, token), token, reviewId };
  }
  return {
    url: canonicalShareUrl(origin, review.id, fallbackToken),
    token: fallbackToken,
    reviewId: review.id,
  };
}

async function updateExistingClientReview(
  input: PersistClientReviewInput,
  currentTip: ExistingReviewTip
): Promise<CreateClientReviewResult> {
  const origin = input.origin.replace(/\/$/, "");
  const existingToken = currentTip.share_token?.trim() || "";
  const previousSelection = currentTip.selection_state ?? {};
  const creatorIds = input.snapshot.creators.map((creator) => creator.creatorId);
  const selection = mergePersistedClientSelection({
    creatorIds,
    previous: previousSelection,
    incoming: input.selection,
    replaceSelection: input.replaceSelection,
  });
  if (
    existingToken &&
    fingerprintsEqual(currentTip.package_fingerprint ?? {}, input.fingerprint) &&
    clientSelectionsEqual(previousSelection, selection, creatorIds)
  ) {
    return {
      ok: true,
      reviewId: currentTip.id,
      reviewNumber: currentTip.review_number,
      frozenVersion: input.frozenVersion ?? 0,
      url: `${origin}${buildClientReviewPath(currentTip.id, existingToken)}`,
      token: existingToken,
      status: currentTip.status,
      source: input.source,
    };
  }

  const now = new Date().toISOString();
  const mintMissing = input.mintMissingShareToken !== false;
  const token = existingToken || (mintMissing ? randomBytes(16).toString("hex") : "");
  const previous = parseSourceSnapshot(currentTip.source_snapshot);
  let snapshot = previous ? retainCreatorBriefs(previous, input.snapshot) : input.snapshot;
  const updates = previous ? diffClientReviewSnapshots(previous, snapshot) : [];
  if (updates.length > 0) {
    snapshot = { ...snapshot, clientUpdate: { updatedAt: now, items: updates } };
  } else if (previous?.clientUpdate) {
    snapshot = { ...snapshot, clientUpdate: previous.clientUpdate };
  }

  const patch: Record<string, unknown> = {
    source_snapshot: snapshot,
    package_fingerprint: input.fingerprint,
    selection_state: selection,
    client_label: input.clientLabel,
    brand_name: input.brandName,
    campaign_name: input.campaignName,
    frozen_version: input.frozenVersion ?? 0,
    updated_at: now,
  };
  if (!existingToken && mintMissing && token) {
    patch.share_token = token;
    patch.token_hash = hashClientReviewToken(token);
  }

  const { data: updated, error } = await input.supabase
    .from("campaign_client_reviews" as never)
    .update(patch as never)
    .eq("id", currentTip.id)
    .select("*")
    .single();
  if (error || !updated) {
    return {
      ok: false,
      message: error?.message ?? "Could not update the Client Workspace link.",
      blockers: [error?.message ?? "Update failed."],
    };
  }
  const review = mapClientReviewRow(updated as ReviewRow);
  return {
    ok: true,
    reviewId: review.id,
    reviewNumber: review.reviewNumber,
    frozenVersion: review.frozenVersion,
    url: `${origin}${buildClientReviewPath(review.id, token)}`,
    token,
    status: review.status,
    source: review.source,
    updates: updates.length > 0 ? updates : undefined,
  };
}

export type PersistClientReviewInput = {
  supabase: SupabaseClient;
  userId: string;
  origin: string;
  source: ClientReviewSource;
  scope: ReviewScope;
  campaignObjectId?: string | null;
  frozenVersion?: number;
  conversationId?: string | null;
  campaignHeaderId?: string | null;
  shortlistId?: string | null;
  quotationId?: string | null;
  clientLabel: string | null;
  brandName: string | null;
  campaignName: string | null;
  fingerprint: Record<string, unknown>;
  selection: Record<string, ClientCreatorSelectionState>;
  snapshot: ClientReviewSourceSnapshot;
  alreadyOpenMessage: string;
  markShortlistItemIds?: string[];
  reuseInteractiveReview?: boolean;
  /** Staff Generate/Show may mint a token once for legacy rows. Public refresh must never rotate. */
  mintMissingShareToken?: boolean;
  /** Public quotation refresh must update an existing review only — never insert. */
  syncExistingOnly?: boolean;
  /** When true, incoming selection replaces previous client choices (campaign-linked quotations). */
  replaceSelection?: boolean;
};

export async function persistClientReview(
  input: PersistClientReviewInput
): Promise<CreateClientReviewResult> {
  const { supabase } = input;
  const origin = input.origin.replace(/\/$/, "");
  let existingQuery = supabase
    .from("campaign_client_reviews" as never)
    .select(
      "id, review_number, status, package_fingerprint, source_snapshot, selection_state, share_token, token_hash, journey_id"
    )
    .eq("source", input.source);
  existingQuery = applyReviewScope(existingQuery, input.scope);
  const { data: existing } = await existingQuery
    .order("review_number", { ascending: false })
    .limit(5);
  const rows = (existing ?? []) as ExistingReviewTip[];
  const currentTip = rows[0];
  const canReuse = Boolean(
    currentTip && isReusableClientReviewTip(currentTip.status, input.reuseInteractiveReview)
  );

  if (canReuse && currentTip) {
    const updated = await updateExistingClientReview(input, currentTip);
    if (!updated.ok) return updated;
    const share = await shareFromJourneyOrReview(
      supabase,
      origin,
      { id: updated.reviewId, journeyId: currentTip.journey_id },
      updated.token
    );
    return { ...updated, url: share.url, token: share.token, reviewId: share.reviewId };
  }

  if (
    currentTip &&
    currentTip.status === "approved" &&
    fingerprintsEqual(currentTip.package_fingerprint ?? {}, input.fingerprint)
  ) {
    const share = await shareFromJourneyOrReview(
      supabase,
      origin,
      { id: currentTip.id, journeyId: currentTip.journey_id },
      currentTip.share_token?.trim() || ""
    );
    if (!share.token) {
      return {
        ok: false,
        message: CLIENT_REVIEW_LINK_MISSING_MESSAGE,
        blockers: [CLIENT_REVIEW_LINK_MISSING_MESSAGE],
      };
    }
    return {
      ok: true,
      reviewId: share.reviewId,
      reviewNumber: currentTip.review_number,
      frozenVersion: input.frozenVersion ?? 0,
      url: share.url,
      token: share.token,
      status: currentTip.status,
      source: input.source,
    };
  }

  if (input.syncExistingOnly) {
    return {
      ok: false,
      message: CLIENT_REVIEW_LINK_MISSING_MESSAGE,
      blockers: [CLIENT_REVIEW_LINK_MISSING_MESSAGE],
    };
  }

  if (
    currentTip &&
    isReusableClientReviewTip(currentTip.status, true) &&
    fingerprintsEqual(currentTip.package_fingerprint ?? {}, input.fingerprint)
  ) {
    return {
      ok: false,
      message: input.alreadyOpenMessage,
      blockers: [
        `Version ${currentTip.review_number} is already in client review for this ${input.source}. Create a new version after the source changes.`,
      ],
    };
  }

  let journey =
    (currentTip?.journey_id ? await loadJourney(supabase, currentTip.journey_id) : null) ??
    (await findJourneyForScope(supabase, input));
  const token = journey?.share_token?.trim() || randomBytes(16).toString("hex");
  if (!journey) {
    journey = await createJourney(supabase, {
      token,
      shortlistId: input.shortlistId,
      quotationId: input.quotationId,
      campaignHeaderId: input.campaignHeaderId,
    });
  }

  let nextNumber = (currentTip?.review_number ?? 0) + 1;
  if (journey) {
    const { data: latestSameSource } = await supabase
      .from("campaign_client_reviews" as never)
      .select("review_number")
      .eq("journey_id", journey.id)
      .eq("source", input.source)
      .order("review_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const latestNumber = (latestSameSource as { review_number?: number } | null)?.review_number ?? 0;
    nextNumber = Math.max(nextNumber, latestNumber + 1);
  }
  const now = new Date().toISOString();
  const reviewToken = randomBytes(16).toString("hex");

  const insert = {
    campaign_object_id: input.campaignObjectId ?? null,
    frozen_version: input.frozenVersion ?? 0,
    review_number: nextNumber,
    token_hash: hashClientReviewToken(reviewToken),
    share_token: reviewToken,
    status: "awaiting_review" as const,
    source: input.source,
    client_label: input.clientLabel,
    brand_name: input.brandName,
    campaign_name: input.campaignName,
    conversation_id: input.conversationId ?? null,
    campaign_header_id: input.campaignHeaderId ?? null,
    shortlist_id: input.shortlistId ?? null,
    quotation_id: input.quotationId ?? null,
    source_snapshot: input.snapshot,
    package_fingerprint: input.fingerprint,
    selection_state: input.selection,
    created_by: input.userId,
    updated_at: now,
    journey_id: journey?.id ?? null,
  };

  const { data: created, error } = await supabase
    .from("campaign_client_reviews" as never)
    .insert(insert as never)
    .select("*")
    .single();

  if (error || !created) {
    return {
      ok: false,
      message: error?.message ?? "Could not create client review.",
      blockers: [error?.message ?? "Insert failed."],
    };
  }

  const review = mapClientReviewRow(created as ReviewRow);

  if (journey && !journey.landing_review_id) {
    await supabase
      .from("campaign_client_journeys" as never)
      .update({
        landing_review_id: review.id,
        share_token: token,
        token_hash: hashClientReviewToken(token),
        shortlist_id: input.shortlistId ?? journey.shortlist_id,
        quotation_id: input.quotationId ?? journey.quotation_id,
        campaign_header_id: input.campaignHeaderId ?? null,
        updated_at: now,
      } as never)
      .eq("id", journey.id);
    journey = { ...journey, landing_review_id: review.id, share_token: token };
  } else if (journey) {
    await supabase
      .from("campaign_client_journeys" as never)
      .update({
        shortlist_id: input.shortlistId ?? journey.shortlist_id,
        quotation_id: input.quotationId ?? journey.quotation_id,
        campaign_header_id: input.campaignHeaderId ?? null,
        updated_at: now,
      } as never)
      .eq("id", journey.id);
  }

  if (currentTip && currentTip.status !== "superseded" && currentTip.status !== "revoked") {
    await supabase
      .from("campaign_client_reviews" as never)
      .update({
        status: "superseded",
        superseded_by: review.id,
        updated_at: now,
      } as never)
      .eq("id", currentTip.id)
      .in("status", ["awaiting_review", "changes_requested"]);
  }

  if (journey && input.source === "quotation") {
    await supabase
      .from("campaign_client_reviews" as never)
      .update({
        status: "superseded",
        superseded_by: review.id,
        updated_at: now,
      } as never)
      .eq("journey_id", journey.id)
      .eq("source", "quotation")
      .neq("id", review.id)
      .in("status", ["awaiting_review", "changes_requested"]);
  }

  if (review.shortlistId && input.source === "shortlist") {
    let shortlistUpdate = supabase
      .from("discovery_shortlist_items")
      .update({ item_status: "under_review" } as never)
      .eq("shortlist_id", review.shortlistId)
      .in("item_status", ["draft"]);
    if (input.markShortlistItemIds?.length) {
      shortlistUpdate = shortlistUpdate.in("id", input.markShortlistItemIds);
    }
    await shortlistUpdate;
  }

  await supabase.from("campaign_client_review_events" as never).insert({
    review_id: review.id,
    event_type:
      currentTip?.status === "approved" && input.source === "quotation"
        ? "quotation_revision_published"
        : "campaign_sent_for_review",
    actor_kind: "internal",
    actor_label: "Thinkway",
    payload: {
      source: input.source,
      review_number: review.reviewNumber,
      frozen_version: review.frozenVersion,
    },
  } as never);

  await logAuditEvent(supabase as never, {
    userId: input.userId,
    action: "submit",
    entityType: "campaign_client_review",
    entityId: review.id,
    metadata: {
      audit_action: "client_review_created",
      source: input.source,
      campaign_object_id: input.campaignObjectId ?? null,
      shortlist_id: input.shortlistId ?? null,
      quotation_id: input.quotationId ?? null,
      frozen_version: review.frozenVersion,
      review_number: review.reviewNumber,
    },
  });

  const share = await shareFromJourneyOrReview(supabase, origin, review, token);
  return {
    ok: true,
    reviewId: share.reviewId,
    reviewNumber: review.reviewNumber,
    frozenVersion: review.frozenVersion,
    url: share.url,
    token: share.token,
    status: review.status,
    source: review.source,
  };
}

export async function revealClientReviewShareLink(input: {
  supabase: SupabaseClient;
  origin: string;
  scope: ReviewScope;
}): Promise<
  | { ok: true; url: string; reviewId: string; reviewNumber: number; created: boolean }
  | { ok: false; message: string }
> {
  let query = input.supabase
    .from("campaign_client_reviews" as never)
    .select("id, review_number, status, share_token, journey_id")
    .eq("source", input.scope.source);
  query = applyReviewScope(query, input.scope);
  const { data } = await query.order("review_number", { ascending: false }).limit(1).maybeSingle();
  const row = data as {
    id: string;
    review_number: number;
    status: ClientReviewStatus;
    share_token?: string | null;
    journey_id?: string | null;
  } | null;
  if (!row) {
    return {
      ok: false,
      message: CLIENT_REVIEW_LINK_MISSING_MESSAGE,
    };
  }
  if (row.status === "revoked") {
    return {
      ok: false,
      message: "The latest Client Workspace version is no longer active. Generate a new link.",
    };
  }

  const origin = input.origin.replace(/\/$/, "");
  const share = await shareFromJourneyOrReview(
    input.supabase,
    origin,
    { id: row.id, journeyId: row.journey_id },
    row.share_token?.trim() || ""
  );
  if (share.token) {
    return {
      ok: true,
      url: share.url,
      reviewId: share.reviewId,
      reviewNumber: row.review_number,
      created: false,
    };
  }

  const token = randomBytes(16).toString("hex");
  const tokenHash = hashClientReviewToken(token);
  const { error } = await input.supabase
    .from("campaign_client_reviews" as never)
    .update({
      share_token: token,
      token_hash: tokenHash,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", row.id);
  if (error) {
    return { ok: false, message: error.message || "Could not load the Client Workspace link." };
  }

  return {
    ok: true,
    url: `${origin}${buildClientReviewPath(row.id, token)}`,
    reviewId: row.id,
    reviewNumber: row.review_number,
    created: false,
  };
}

export async function peekClientReviewShareLink(input: {
  supabase: SupabaseClient;
  scope: ReviewScope;
}): Promise<{ exists: boolean; reviewNumber?: number }> {
  let query = input.supabase
    .from("campaign_client_reviews" as never)
    .select("review_number, status")
    .eq("source", input.scope.source);
  query = applyReviewScope(query, input.scope);
  const { data } = await query.order("review_number", { ascending: false }).limit(1).maybeSingle();
  const row = data as { review_number: number; status: ClientReviewStatus } | null;
  if (!row || row.status === "revoked" || row.status === "superseded") {
    return { exists: false };
  }
  return { exists: true, reviewNumber: row.review_number };
}
