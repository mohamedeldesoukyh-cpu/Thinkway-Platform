import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import {
  createQuotationFromSelection,
  createQuotationFromShortlist,
} from "@/lib/services/quotations/quotation-service";
import type { QuotationItemSeed } from "@/lib/domains/commercial/quotation-types";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ClientChangeArea,
  ClientCommentTargetType,
  ClientCreatorSelectionState,
} from "./constants";
import { mapClientReviewRow } from "./persist-client-review";
import { resolveClientReviewByToken, newerReviewNumberFor } from "./load-client-workspace";
import { clientCreatorIds, projectClientCommercial } from "./project-client-view";
import { projectCommercialFromSnapshot, snapshotCreatorIds } from "./snapshot";
import { clientSelectionToShortlistStatus, isInteractiveClientReview } from "./status";

function db(): SupabaseClient {
  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    throw new Error("Client Workspace is temporarily unavailable.");
  }
  return service;
}

async function requireInteractiveReview(token: string) {
  const resolved = await resolveClientReviewByToken(db(), token);
  if (!resolved.ok) {
    return { ok: false as const, message: "This review link is invalid or has expired." };
  }
  if (!isInteractiveClientReview(resolved.review.status)) {
    return { ok: false as const, message: "This version is no longer open for decisions." };
  }
  const newer = await newerReviewNumberFor(db(), resolved.review);
  if (newer) {
    return { ok: false as const, message: "A new version requires review. Decisions on this version are closed." };
  }
  return { ok: true as const, review: resolved.review };
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
}): Promise<{ ok: boolean; message: string; selection?: Record<string, ClientCreatorSelectionState> }> {
  const gate = await requireInteractiveReview(input.token);
  if (!gate.ok) return gate;

  const selection = { ...gate.review.selectionState, [input.creatorId]: input.state };
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update({
      selection_state: selection,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", gate.review.id);
  if (error) return { ok: false, message: error.message };

  if (gate.review.shortlistId) {
    const shortlistStatus = clientSelectionToShortlistStatus(input.state);
    const rawId = input.creatorId.replace(/^(inf|dis):/, "");
    await db()
      .from("discovery_shortlist_items")
      .update({ item_status: shortlistStatus } as never)
      .eq("shortlist_id", gate.review.shortlistId)
      .or(
        `id.eq.${input.creatorId},influencer_id.eq.${rawId},profile_id.eq.${rawId},unified_id.eq.${input.creatorId},unified_id.eq.${rawId}`
      );
  }

  await db().from("campaign_client_review_events" as never).insert({
    review_id: gate.review.id,
    event_type: input.state === "rejected" ? "creator_rejected" : "creator_selected",
    actor_kind: "client",
    actor_label: gate.review.clientLabel ?? "Client",
    payload: { creatorId: input.creatorId, name: input.creatorName, state: input.state },
  } as never);

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
  for (const id of ids) selection[id] = input.state;
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update({ selection_state: selection, updated_at: new Date().toISOString() } as never)
    .eq("id", gate.review.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Selection updated." };
}

export async function addClientComment(input: {
  token: string;
  targetType: ClientCommentTargetType;
  targetId?: string | null;
  message: string;
}): Promise<{ ok: boolean; message: string }> {
  const gate = await requireInteractiveReview(input.token);
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
}): Promise<{ ok: boolean; message: string }> {
  const gate = await requireInteractiveReview(input.token);
  if (!gate.ok) return gate;
  const summary = input.summary.trim();
  if (!summary) return { ok: false, message: "Describe the change you need." };
  const areas = input.areas.length > 0 ? input.areas : (["campaign"] as ClientChangeArea[]);
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update({
      status: "changes_requested",
      change_request_summary: summary,
      change_request_areas: areas,
      updated_at: new Date().toISOString(),
    } as never)
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

export async function decideClientReview(input: {
  token: string;
  decision: "approved" | "rejected";
  actorLabel?: string;
}): Promise<{ ok: boolean; message: string; quotationId?: string }> {
  const gate = await requireInteractiveReview(input.token);
  if (!gate.ok) return gate;

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
  const acceptedIds = Object.entries(gate.review.selectionState)
    .filter(([, state]) => state === "accepted")
    .map(([id]) => id);
  const selectedIds =
    acceptedIds.length > 0
      ? acceptedIds
      : frozenIds.filter((id) => gate.review.selectionState[id] !== "rejected");

  if (input.decision === "approved" && selectedIds.length === 0) {
    return { ok: false, message: "Select at least one creator before approving." };
  }

  const now = new Date().toISOString();
  const { error } = await db()
    .from("campaign_client_reviews" as never)
    .update({
      status: input.decision,
      approved_creator_ids: input.decision === "approved" ? selectedIds : [],
      approved_commercial: input.decision === "approved" ? commercial : null,
      approved_at: now,
      approved_by_label: input.actorLabel?.trim() || gate.review.clientLabel || "Client",
      updated_at: now,
    } as never)
    .eq("id", gate.review.id)
    .in("status", ["awaiting_review", "changes_requested"]);
  if (error) return { ok: false, message: error.message };

  await db().from("campaign_client_review_events" as never).insert({
    review_id: gate.review.id,
    event_type: input.decision === "approved" ? "client_approved" : "client_rejected",
    actor_kind: "client",
    actor_label: input.actorLabel?.trim() || gate.review.clientLabel || "Client",
    payload: {
      version: gate.review.reviewNumber,
      frozen_version: gate.review.frozenVersion,
      selected_creators: selectedIds,
      commercial,
    },
  } as never);

  if (input.decision !== "approved") {
    return { ok: true, message: "Campaign rejected." };
  }

  if (gate.review.source === "quotation") {
    return { ok: true, message: "Campaign approved. The quotation already holds the commercial values." };
  }

  const { data: ownerRow } = await db()
    .from("campaign_client_reviews" as never)
    .select("created_by")
    .eq("id", gate.review.id)
    .maybeSingle();
  const actorId = (ownerRow as { created_by?: string } | null)?.created_by;
  if (!actorId) {
    return { ok: true, message: "Campaign approved. Internal team will generate the quotation." };
  }

  try {
    let quotation: Awaited<ReturnType<typeof createQuotationFromShortlist>>;
    if (gate.review.shortlistId) {
      const { data: items } = await db()
        .from("discovery_shortlist_items")
        .select("id, influencer_id, profile_id, unified_id")
        .eq("shortlist_id", gate.review.shortlistId);
      const selected = new Set(selectedIds.map((id) => id.replace(/^(inf|dis):/, "")));
      const itemIds = ((items ?? []) as Array<{
        id: string;
        influencer_id: string | null;
        profile_id: string | null;
        unified_id: string | null;
      }>)
        .filter((item) =>
          [item.influencer_id, item.profile_id, item.unified_id].some(
            (value) => value && selected.has(value.replace(/^(inf|dis):/, ""))
          )
        )
        .map((item) => item.id);
      quotation = await createQuotationFromShortlist(db() as never, actorId, gate.review.shortlistId, {
        itemIds: itemIds.length > 0 ? itemIds : undefined,
      });
    } else {
      const perCreator =
        commercial.selectedCount > 0
          ? Math.round(commercial.totalInvestment / commercial.selectedCount)
          : null;
      const seeds: QuotationItemSeed[] = selectedIds.map((creatorId) => ({
        creator_name: creatorId,
        influencer_id: creatorId.replace(/^inf:/, ""),
        unified_id: creatorId,
        revenue: perCreator,
        cost_currency: commercial.currency,
      }));
      quotation = await createQuotationFromSelection(db() as never, actorId, {
        name: `${gate.review.campaignName ?? "Campaign"} — Client approved v${gate.review.reviewNumber}`,
        creators: seeds,
      });
    }
    if (quotation.ok) {
      await db().from("campaign_client_review_events" as never).insert({
        review_id: gate.review.id,
        event_type: "quotation_generated",
        actor_kind: "system",
        actor_label: "Thinkway",
        payload: { quotationId: quotation.data?.id },
      } as never);
      return {
        ok: true,
        message: "Campaign approved. Quotation reflects the selected creators.",
        quotationId: quotation.data?.id,
      };
    }
    return {
      ok: true,
      message: `Campaign approved. Quotation will be generated internally (${quotation.message}).`,
    };
  } catch (error) {
    return {
      ok: true,
      message: `Campaign approved. Quotation handoff pending: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export function mapReview(row: unknown) {
  return mapClientReviewRow(row as Parameters<typeof mapClientReviewRow>[0]);
}
