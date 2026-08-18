import { logAuditEvent } from "@/lib/audit/log-audit-event";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

import {
  CLIENT_REVIEW_LINK_MISSING_MESSAGE,
  type ClientCreatorSelectionState,
  type ClientReviewSource,
  type ClientReviewStatus,
} from "./constants";
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
};

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
  let existingQuery = supabase
    .from("campaign_client_reviews" as never)
    .select("id, review_number, status, package_fingerprint, source_snapshot, selection_state, share_token, token_hash")
    .eq("source", input.source);
  existingQuery = applyReviewScope(existingQuery, input.scope);
  const { data: existing } = await existingQuery
    .order("review_number", { ascending: false })
    .limit(5);
  const rows = (existing ?? []) as Array<{
    id: string;
    review_number: number;
    status: ClientReviewStatus;
    package_fingerprint: Record<string, unknown> | null;
    source_snapshot?: ClientReviewSourceSnapshot | Record<string, unknown> | null;
    selection_state?: Record<string, ClientCreatorSelectionState> | null;
    share_token?: string | null;
    token_hash?: string | null;
  }>;
  const currentTip = rows[0];
  const canReuse =
    Boolean(input.reuseInteractiveReview) &&
    currentTip &&
    currentTip.status !== "revoked" &&
    currentTip.status !== "superseded";

  if (canReuse && currentTip) {
    return updateExistingClientReview(input, currentTip);
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
    (currentTip.status === "awaiting_review" || currentTip.status === "changes_requested") &&
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

  const nextNumber = (currentTip?.review_number ?? 0) + 1;
  const token = randomBytes(16).toString("hex");
  const tokenHash = hashClientReviewToken(token);
  const now = new Date().toISOString();

  const insert = {
    campaign_object_id: input.campaignObjectId ?? null,
    frozen_version: input.frozenVersion ?? 0,
    review_number: nextNumber,
    token_hash: tokenHash,
    share_token: token,
    status: "awaiting_review",
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
    event_type: "campaign_sent_for_review",
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

  const origin = input.origin.replace(/\/$/, "");
  return {
    ok: true,
    reviewId: review.id,
    reviewNumber: review.reviewNumber,
    frozenVersion: review.frozenVersion,
    url: `${origin}${buildClientReviewPath(review.id, token)}`,
    token,
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
    .select("id, review_number, status, share_token")
    .eq("source", input.scope.source);
  query = applyReviewScope(query, input.scope);
  const { data } = await query.order("review_number", { ascending: false }).limit(1).maybeSingle();
  const row = data as {
    id: string;
    review_number: number;
    status: ClientReviewStatus;
    share_token?: string | null;
  } | null;
  if (!row) {
    return {
      ok: false,
      message: CLIENT_REVIEW_LINK_MISSING_MESSAGE,
    };
  }
  if (row.status === "revoked" || row.status === "superseded") {
    return {
      ok: false,
      message: "The latest Client Workspace version is no longer active. Generate a new link.",
    };
  }

  const origin = input.origin.replace(/\/$/, "");
  const existingToken = row.share_token?.trim() || "";
  if (existingToken) {
    return {
      ok: true,
      url: `${origin}${buildClientReviewPath(row.id, existingToken)}`,
      reviewId: row.id,
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
