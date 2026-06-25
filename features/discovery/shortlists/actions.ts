"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CampaignShortlistAssignmentStatus,
  Database,
  ShortlistItemStatus,
  ShortlistStatus,
  ShortlistVisibilityV2,
} from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueCreatorEnrichmentBestEffort } from "@/lib/creator-enrichment/queue";
import { priorityForTrigger } from "@/lib/creator-enrichment/policy";

import { SHORTLIST_PERMISSIONS } from "./constants";
import { getCampaignShortlistAssignments } from "./queries";
import { logCreatorMovement, logShortlistLifecycle } from "./movements";
import { notifyShortlistEvent } from "./notifications";
import { promoteDiscoveredProfileToInfluencer } from "./promote";
import { canMoveItemToCampaign } from "./item-transitions";
import {
  assertTransition,
  canEditCreators,
  isMovementLocked,
} from "./transitions";
import {
  assertShortlistApprovedForMove,
  SHORTLIST_NOT_APPROVED_MESSAGE,
  validateMoveToCampaign,
  type MoveTarget,
} from "./move-policy";
import type { ActionResult } from "./types";

type Supabase = SupabaseClient<Database>;

const LIST_PATH = "/discovery/shortlists";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

function revalidateShortlist(id?: string) {
  revalidatePath(LIST_PATH);
  if (id) revalidatePath(detailPath(id));
}

async function getActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.write);
  if ("error" in auth) {
    // Admins without explicit write still pass via requirePermission bypass; if we
    // get here the user lacks discovery access entirely.
    const adminAuth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.admin);
    if ("error" in adminAuth) return { ok: false, message: auth.error };
    return { ok: true, supabase, userId: adminAuth.userId };
  }
  return { ok: true, supabase, userId: auth.userId };
}

async function requireApprover(): Promise<
  | { ok: true; supabase: Supabase; userId: string }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.admin);
  if ("error" in auth) {
    return {
      ok: false,
      message: "Only a Team Leader or Admin can approve or reject shortlists.",
    };
  }
  return { ok: true, supabase, userId: auth.userId };
}

async function loadShortlistRow(supabase: Supabase, id: string) {
  const { data, error } = await supabase
    .from("discovery_shortlists")
    .select(
      "id, name, status, visibility, owner_id, created_by, approved_by, is_archived"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as
    | {
        id: string;
        name: string;
        status: ShortlistStatus;
        visibility: ShortlistVisibilityV2;
        owner_id: string | null;
        created_by: string | null;
        approved_by: string | null;
        is_archived: boolean;
      }
    | null;
}

function recipientsFor(row: {
  owner_id: string | null;
  created_by: string | null;
  approved_by: string | null;
}): Array<string | null> {
  return [row.owner_id, row.created_by, row.approved_by];
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------
export type CreateShortlistV2Input = {
  name: string;
  description?: string | null;
  visibility?: ShortlistVisibilityV2;
  clientId?: string | null;
  brandId?: string | null;
  campaignHeaderId?: string | null;
};

export async function createShortlistV2(
  input: CreateShortlistV2Input
): Promise<{ id: string; serial_number: string | null; name: string }> {
  const actor = await getActor();
  if (!actor.ok) throw new Error(actor.message);

  const name = input.name?.trim();
  if (!name) throw new Error("Shortlist name is required.");

  const visibility: ShortlistVisibilityV2 =
    input.visibility === "client_shared" ? "team" : input.visibility ?? "private";

  const { data, error } = await actor.supabase
    .from("discovery_shortlists")
    .insert({
      name,
      description: input.description?.trim() || null,
      owner_id: actor.userId,
      created_by: actor.userId,
      visibility,
      status: "draft",
      client_id: input.clientId || null,
      brand_id: input.brandId || null,
      campaign_header_id: input.campaignHeaderId || null,
    })
    .select("id, serial_number, name, owner_id, created_by, approved_by")
    .single();

  if (error) throw new Error(error.message);

  await notifyShortlistEvent(actor.supabase, {
    shortlistId: data.id as string,
    event: "created",
    actorId: actor.userId,
    recipientIds: recipientsFor(data as never),
    body: `${name} created as a draft shortlist.`,
  });

  revalidateShortlist(data.id as string);
  return {
    id: data.id as string,
    serial_number: (data.serial_number as string) ?? null,
    name: data.name as string,
  };
}

export type UpdateShortlistInput = {
  shortlistId: string;
  name?: string;
  description?: string | null;
  visibility?: ShortlistVisibilityV2;
  clientId?: string | null;
  brandId?: string | null;
};

export async function updateShortlistDetails(
  input: UpdateShortlistInput
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const row = await loadShortlistRow(actor.supabase, input.shortlistId);
  if (!row) return { ok: false, message: "Shortlist not found." };
  if (row.is_archived) return { ok: false, message: "Archived shortlists are read-only." };
  if (isMovementLocked(row.status)) {
    return { ok: false, message: "Cancelled shortlists cannot be edited. Reopen first." };
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) return { ok: false, message: "Shortlist name is required." };
    patch.name = trimmed;
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.visibility !== undefined) {
    patch.visibility = input.visibility === "client_shared" ? "team" : input.visibility;
  }
  if (input.clientId !== undefined) patch.client_id = input.clientId || null;
  if (input.brandId !== undefined) patch.brand_id = input.brandId || null;

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await actor.supabase
    .from("discovery_shortlists")
    .update(patch as never)
    .eq("id", input.shortlistId);

  if (error) return { ok: false, message: error.message };
  revalidateShortlist(input.shortlistId);
  return { ok: true, message: "Shortlist updated." };
}

// ---------------------------------------------------------------------------
// Status workflow
// ---------------------------------------------------------------------------
async function transitionStatus(
  supabase: Supabase,
  shortlistId: string,
  to: ShortlistStatus,
  patch: Record<string, unknown> = {}
): Promise<ActionResult & { row?: Awaited<ReturnType<typeof loadShortlistRow>> }> {
  const row = await loadShortlistRow(supabase, shortlistId);
  if (!row) return { ok: false, message: "Shortlist not found." };

  try {
    assertTransition(row.status, to);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid status change.",
    };
  }

  const { error } = await supabase
    .from("discovery_shortlists")
    .update({ status: to, ...patch } as never)
    .eq("id", shortlistId);

  if (error) return { ok: false, message: error.message };
  return { ok: true, row };
}

export async function submitShortlistForReview(
  shortlistId: string
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const { count } = await actor.supabase
    .from("discovery_shortlist_items")
    .select("id", { count: "exact", head: true })
    .eq("shortlist_id", shortlistId);

  if (!count || count === 0) {
    return { ok: false, message: "Add at least one creator before submitting for review." };
  }

  const result = await transitionStatus(actor.supabase, shortlistId, "under_review", {
    submitted_at: new Date().toISOString(),
  });
  if (!result.ok) return result;

  await logShortlistLifecycle(actor.supabase, {
    action: "shortlist_submitted",
    shortlistId,
    performedBy: actor.userId,
  });

  await notifyShortlistEvent(actor.supabase, {
    shortlistId,
    event: "submitted_for_review",
    actorId: actor.userId,
    recipientIds: recipientsFor(result.row!),
  });

  revalidateShortlist(shortlistId);
  return { ok: true, message: "Shortlist submitted for review." };
}

export async function approveShortlist(shortlistId: string): Promise<ActionResult> {
  const actor = await requireApprover();
  if (!actor.ok) return actor;

  const result = await transitionStatus(actor.supabase, shortlistId, "approved", {
    approved_by: actor.userId,
    approved_at: new Date().toISOString(),
  });
  if (!result.ok) return result;

  await actor.supabase
    .from("discovery_shortlist_items")
    .update({ item_status: "approved" } as never)
    .eq("shortlist_id", shortlistId)
    .eq("item_status", "under_review");

  await logShortlistLifecycle(actor.supabase, {
    action: "shortlist_approved",
    shortlistId,
    performedBy: actor.userId,
  });

  await notifyShortlistEvent(actor.supabase, {
    shortlistId,
    event: "approved",
    actorId: actor.userId,
    recipientIds: [...recipientsFor(result.row!), actor.userId],
  });

  revalidateShortlist(shortlistId);
  return { ok: true, message: "Shortlist approved. Creators can now be moved to a campaign." };
}

export async function rejectShortlist(
  shortlistId: string,
  reason?: string
): Promise<ActionResult> {
  const actor = await requireApprover();
  if (!actor.ok) return actor;

  const result = await transitionStatus(actor.supabase, shortlistId, "draft");
  if (!result.ok) return result;

  await actor.supabase
    .from("discovery_shortlist_items")
    .update({ item_status: "rejected" } as never)
    .eq("shortlist_id", shortlistId)
    .eq("item_status", "under_review");

  await logShortlistLifecycle(actor.supabase, {
    action: "shortlist_rejected",
    shortlistId,
    performedBy: actor.userId,
    notes: reason?.trim() || null,
  });

  await notifyShortlistEvent(actor.supabase, {
    shortlistId,
    event: "rejected",
    actorId: actor.userId,
    recipientIds: recipientsFor(result.row!),
    body: reason?.trim() || "Returned to draft for changes.",
  });

  revalidateShortlist(shortlistId);
  return { ok: true, message: "Shortlist returned to draft." };
}

export async function cancelShortlist(
  shortlistId: string,
  reason?: string
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const result = await transitionStatus(actor.supabase, shortlistId, "cancelled", {
    cancelled_at: new Date().toISOString(),
    cancelled_by: actor.userId,
    cancellation_reason: reason?.trim() || null,
  });
  if (!result.ok) return result;

  await logShortlistLifecycle(actor.supabase, {
    action: "shortlist_cancelled",
    shortlistId,
    performedBy: actor.userId,
    notes: reason?.trim() || null,
  });

  await notifyShortlistEvent(actor.supabase, {
    shortlistId,
    event: "cancelled",
    actorId: actor.userId,
    recipientIds: recipientsFor(result.row!),
    body: reason?.trim() || undefined,
  });

  revalidateShortlist(shortlistId);
  return { ok: true, message: "Shortlist cancelled. Serial and creators are retained." };
}

export async function reopenShortlist(shortlistId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const result = await transitionStatus(actor.supabase, shortlistId, "draft", {
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
  });
  if (!result.ok) return result;

  await logShortlistLifecycle(actor.supabase, {
    action: "shortlist_reopened",
    shortlistId,
    performedBy: actor.userId,
  });

  revalidateShortlist(shortlistId);
  return { ok: true, message: "Shortlist reopened as draft." };
}

export async function archiveShortlist(shortlistId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const result = await transitionStatus(actor.supabase, shortlistId, "archived", {
    is_archived: true,
  });
  if (!result.ok) return result;

  await logShortlistLifecycle(actor.supabase, {
    action: "shortlist_archived",
    shortlistId,
    performedBy: actor.userId,
  });

  revalidateShortlist(shortlistId);
  return { ok: true, message: "Shortlist archived (soft delete)." };
}

// ---------------------------------------------------------------------------
// Creators
// ---------------------------------------------------------------------------
export type AddCreatorInput = {
  shortlistId: string;
  unifiedId?: string | null;
  discoveredProfileId?: string | null;
  influencerId?: string | null;
  notes?: string | null;
  matchScore?: number | null;
};

export async function addCreatorToShortlistV2(
  input: AddCreatorInput
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  if (!input.discoveredProfileId && !input.influencerId) {
    return { ok: false, message: "A creator reference is required." };
  }

  const row = await loadShortlistRow(actor.supabase, input.shortlistId);
  if (!row) return { ok: false, message: "Shortlist not found." };
  if (!canEditCreators(row.status)) {
    return {
      ok: false,
      message: "Creators can only be added while the shortlist is a Draft or Under Review.",
    };
  }

  let existingQuery = actor.supabase
    .from("discovery_shortlist_items")
    .select("id")
    .eq("shortlist_id", input.shortlistId);
  if (input.discoveredProfileId) {
    existingQuery = existingQuery.eq("profile_id", input.discoveredProfileId);
  } else if (input.influencerId) {
    existingQuery = existingQuery.eq("influencer_id", input.influencerId);
  }
  const { data: existing } = await existingQuery.maybeSingle();
  if (existing?.id) {
    return { ok: true, message: "Creator is already on this shortlist." };
  }

  const { error } = await actor.supabase.from("discovery_shortlist_items").insert({
    shortlist_id: input.shortlistId,
    profile_id: input.discoveredProfileId || null,
    influencer_id: input.influencerId || null,
    unified_id: input.unifiedId || null,
    notes: input.notes?.trim() || null,
    match_score: input.matchScore ?? null,
    added_by: actor.userId,
  });
  if (error) return { ok: false, message: error.message };

  await logCreatorMovement(actor.supabase, {
    action: "discovery_to_shortlist",
    sourceType: "discovery",
    sourceId: input.discoveredProfileId || input.influencerId || null,
    destinationType: "shortlist",
    destinationId: input.shortlistId,
    performedBy: actor.userId,
    influencerId: input.influencerId,
    discoveredProfileId: input.discoveredProfileId,
    unifiedId: input.unifiedId,
  });

  // Phase 3 trigger (spec §4): enqueue background enrichment when a real creator
  // is added. Non-blocking & best-effort — never delays or fails shortlist add.
  // The worker honors the 30-day skip (only enriches if never enriched OR stale).
  if (input.influencerId) {
    enqueueCreatorEnrichmentBestEffort({
      influencerId: input.influencerId,
      discoveredProfileId: input.discoveredProfileId ?? null,
      trigger: "shortlist",
      priority: priorityForTrigger("shortlist"),
      force: false,
      requestedBy: actor.userId,
    });
  }

  revalidateShortlist(input.shortlistId);
  return { ok: true, message: "Creator added to shortlist." };
}

export async function removeCreatorFromShortlistV2(
  shortlistId: string,
  itemId: string
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const row = await loadShortlistRow(actor.supabase, shortlistId);
  if (!row) return { ok: false, message: "Shortlist not found." };
  if (!canEditCreators(row.status)) {
    return {
      ok: false,
      message: "Creators can only be removed while the shortlist is a Draft or Under Review.",
    };
  }

  const { data: item } = await actor.supabase
    .from("discovery_shortlist_items")
    .select("id, profile_id, influencer_id, unified_id")
    .eq("id", itemId)
    .eq("shortlist_id", shortlistId)
    .maybeSingle();

  const { error } = await actor.supabase
    .from("discovery_shortlist_items")
    .delete()
    .eq("id", itemId)
    .eq("shortlist_id", shortlistId);

  if (error) return { ok: false, message: error.message };

  const removed = item as
    | { profile_id: string | null; influencer_id: string | null; unified_id: string | null }
    | null;
  await logCreatorMovement(actor.supabase, {
    action: "creator_removed",
    sourceType: "shortlist",
    sourceId: shortlistId,
    destinationType: "removed",
    destinationId: null,
    performedBy: actor.userId,
    influencerId: removed?.influencer_id ?? null,
    discoveredProfileId: removed?.profile_id ?? null,
    unifiedId: removed?.unified_id ?? null,
    notes: "Removed from shortlist.",
  });

  revalidateShortlist(shortlistId);
  return { ok: true, message: "Creator removed from shortlist." };
}

// ---------------------------------------------------------------------------
// Move To Campaign (spec §7, §8, §9)
// ---------------------------------------------------------------------------
async function createCampaignHeaderFromBrand(
  supabase: Supabase,
  userId: string,
  input: {
    name: string;
    brandId: string;
    country?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    budget?: number | null;
  }
): Promise<{ ok: true; id: string; document_number: string } | { ok: false; message: string }> {
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select(
      "id, client_id, group_id, category_id, subcategory_id, vr_rate_id, currency_code, client:clients(agency_or_direct)"
    )
    .eq("id", input.brandId)
    .maybeSingle();

  if (brandError || !brand) {
    return { ok: false, message: brandError?.message ?? "Brand not found." };
  }

  const brandRow = brand as unknown as {
    id: string;
    client_id: string;
    group_id: string;
    category_id: string | null;
    subcategory_id: string | null;
    vr_rate_id: string | null;
    currency_code: string;
    client: { agency_or_direct: string | null } | null;
  };

  const metadata: Record<string, unknown> = {};
  if (input.country) metadata.country = input.country;

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .insert({
      name: input.name.trim(),
      brand_id: brandRow.id,
      client_id: brandRow.client_id,
      group_id: brandRow.group_id,
      status: "draft",
      currency_code: brandRow.currency_code,
      category_id: brandRow.category_id,
      subcategory_id: brandRow.subcategory_id,
      agency_or_direct: brandRow.client?.agency_or_direct ?? null,
      vr_rate_id: brandRow.vr_rate_id,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      metadata,
      created_by: userId,
    } as never)
    .select("id, document_number")
    .single();

  if (headerError || !header) {
    return { ok: false, message: headerError?.message ?? "Failed to create campaign." };
  }

  const budget = Number(input.budget) || 0;
  await supabase
    .from("campaign_headers")
    .update({
      po_currency: brandRow.currency_code,
      po_exchange_rate: 1,
      po_amount_original: budget,
      po_amount_campaign_currency: budget,
      po_status: budget > 0 ? "active" : "draft",
    } as never)
    .eq("id", (header as { id: string }).id);

  return {
    ok: true,
    id: (header as { id: string }).id,
    document_number: (header as { document_number: string }).document_number,
  };
}

export type MoveToCampaignInput = {
  shortlistId: string;
  itemIds: string[];
  target: MoveTarget;
  /** Spec §8 — user must acknowledge name mismatch before existing-campaign move. */
  acknowledgeNameMismatch?: boolean;
};

export async function moveShortlistToCampaign(
  input: MoveToCampaignInput
): Promise<ActionResult & { campaignId?: string; documentNumber?: string }> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const row = await loadShortlistRow(actor.supabase, input.shortlistId);
  if (!row) return { ok: false, message: "Shortlist not found." };

  // Shared approval gate — single source of truth across all move entry points.
  try {
    assertShortlistApprovedForMove(row.status);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : SHORTLIST_NOT_APPROVED_MESSAGE,
    };
  }

  const validation = validateMoveToCampaign({
    status: row.status,
    selectedItemIds: input.itemIds,
    target: input.target,
  });
  if (!validation.ok) return validation;

  // Resolve / create the destination campaign.
  let campaignId: string;
  let documentNumber: string;

  if (input.target.mode === "existing") {
    campaignId = input.target.campaignId;
    const { data: header } = await actor.supabase
      .from("campaign_headers")
      .select("id, document_number, account_manager_id")
      .eq("id", campaignId)
      .maybeSingle();
    if (!header) return { ok: false, message: "Selected campaign not found." };
    documentNumber = (header as { document_number: string }).document_number;
  } else {
    const created = await createCampaignHeaderFromBrand(actor.supabase, actor.userId, {
      name: input.target.name,
      brandId: input.target.brandId,
      country: input.target.country,
      startDate: input.target.startDate,
      endDate: input.target.endDate,
      budget: input.target.budget,
    });
    if (!created.ok) return created;
    campaignId = created.id;
    documentNumber = created.document_number;
  }

  // Load only the SELECTED items (spec §7: only selected creators move).
  const { data: items, error: itemsError } = await actor.supabase
    .from("discovery_shortlist_items")
    .select("id, profile_id, influencer_id, unified_id, item_status")
    .eq("shortlist_id", input.shortlistId)
    .in("id", input.itemIds);

  if (itemsError) return { ok: false, message: itemsError.message };
  if (!items || items.length === 0) {
    return { ok: false, message: "No matching creators were found to move." };
  }

  let moved = 0;
  const failures: string[] = [];

  for (const item of items as Array<{
    id: string;
    profile_id: string | null;
    influencer_id: string | null;
    unified_id: string | null;
    item_status: ShortlistItemStatus;
  }>) {
    if (!canMoveItemToCampaign(item.item_status)) {
      failures.push("Creator must be approved before moving to a campaign.");
      continue;
    }

    let influencerId = item.influencer_id;

    if (!influencerId && item.profile_id) {
      const promotion = await promoteDiscoveredProfileToInfluencer(
        actor.supabase,
        item.profile_id,
        actor.userId
      );
      if (!promotion.ok) {
        failures.push(promotion.message);
        continue;
      }
      influencerId = promotion.influencerId;
    }

    if (!influencerId) {
      failures.push("Creator could not be resolved to an influencer.");
      continue;
    }

    // Avoid duplicate rows: NULL campaign_line_id is "distinct" under the unique
    // constraint, so we reconcile manually instead of relying on upsert/onConflict.
    const { data: existingAssignment } = await actor.supabase
      .from("campaign_influencers")
      .select("id")
      .eq("campaign_header_id", campaignId)
      .eq("influencer_id", influencerId)
      .maybeSingle();

    const assignmentPayload = {
      shortlist_assignment_status: "suggested" as CampaignShortlistAssignmentStatus,
      source_shortlist_id: input.shortlistId,
      source_shortlist_item_id: item.id,
      returned_to_shortlist_at: null,
    };

    const assignError = existingAssignment?.id
      ? (
          await actor.supabase
            .from("campaign_influencers")
            .update(assignmentPayload as never)
            .eq("id", existingAssignment.id)
        ).error
      : (
          await actor.supabase.from("campaign_influencers").insert({
            campaign_id: campaignId,
            campaign_header_id: campaignId,
            campaign_line_id: null,
            influencer_id: influencerId,
            status: "invited",
            created_by: actor.userId,
            ...assignmentPayload,
          } as never)
        ).error;

    if (assignError) {
      failures.push(assignError.message);
      continue;
    }

    moved += 1;

    await actor.supabase
      .from("discovery_shortlist_items")
      .update({ item_status: "moved_to_campaign" } as never)
      .eq("id", item.id);

    await logCreatorMovement(actor.supabase, {
      action: "shortlist_to_campaign",
      sourceType: "shortlist",
      sourceId: input.shortlistId,
      destinationType: "campaign",
      destinationId: campaignId,
      performedBy: actor.userId,
      influencerId,
      discoveredProfileId: item.profile_id,
      unifiedId: item.unified_id,
      notes: `Moved to ${documentNumber} as Suggested.`,
    });

    // Phase 3 trigger (spec §5): creator moved Approved shortlist -> campaign is
    // the highest-value signal, so enqueue HIGH priority (1) enrichment.
    // Non-blocking & best-effort; the worker still honors the 30-day skip.
    enqueueCreatorEnrichmentBestEffort({
      influencerId,
      discoveredProfileId: item.profile_id,
      trigger: "campaign",
      priority: priorityForTrigger("campaign"),
      force: false,
      requestedBy: actor.userId,
    });
  }

  if (moved === 0) {
    return {
      ok: false,
      message: failures[0] ?? "No creators were moved.",
    };
  }

  await notifyShortlistEvent(actor.supabase, {
    shortlistId: input.shortlistId,
    event: "moved_to_campaign",
    actorId: actor.userId,
    recipientIds: [row.owner_id, row.created_by, row.approved_by],
    body: `${moved} creator(s) moved to ${documentNumber} as Suggested.`,
    metadata: { campaignId, documentNumber, moved },
  });

  revalidateShortlist(input.shortlistId);
  revalidatePath(`/campaigns/${campaignId}`);

  const message =
    failures.length > 0
      ? `Moved ${moved} creator(s) to ${documentNumber}. ${failures.length} could not be moved.`
      : `Moved ${moved} creator(s) to ${documentNumber} as Suggested.`;

  return { ok: true, message, campaignId, documentNumber };
}

// ---------------------------------------------------------------------------
// Return from campaign (spec §10) — campaign workspace actions
// ---------------------------------------------------------------------------
export async function listCampaignShortlistAssignments(campaignHeaderId: string) {
  return getCampaignShortlistAssignments(campaignHeaderId);
}

async function loadAssignment(supabase: Supabase, assignmentId: string) {
  const { data } = await supabase
    .from("campaign_influencers")
    .select(
      "id, campaign_header_id, influencer_id, source_shortlist_id, source_shortlist_item_id"
    )
    .eq("id", assignmentId)
    .maybeSingle();
  return data as
    | {
        id: string;
        campaign_header_id: string | null;
        influencer_id: string;
        source_shortlist_id: string | null;
        source_shortlist_item_id: string | null;
      }
    | null;
}

export async function returnAssignmentToShortlist(
  assignmentId: string
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const assignment = await loadAssignment(actor.supabase, assignmentId);
  if (!assignment) return { ok: false, message: "Assignment not found." };

  const { error } = await actor.supabase
    .from("campaign_influencers")
    .update({
      shortlist_assignment_status: "removed" as CampaignShortlistAssignmentStatus,
      returned_to_shortlist_at: new Date().toISOString(),
    } as never)
    .eq("id", assignmentId);
  if (error) return { ok: false, message: error.message };

  await logCreatorMovement(actor.supabase, {
    action: "campaign_to_shortlist",
    sourceType: "campaign",
    sourceId: assignment.campaign_header_id,
    destinationType: "shortlist",
    destinationId: assignment.source_shortlist_id,
    performedBy: actor.userId,
    influencerId: assignment.influencer_id,
    notes: "Returned to original shortlist.",
  });

  if (assignment.source_shortlist_id) {
    await notifyShortlistEvent(actor.supabase, {
      shortlistId: assignment.source_shortlist_id,
      event: "returned_from_campaign",
      actorId: actor.userId,
      recipientIds: [actor.userId],
      body: "A creator was returned from the campaign to this shortlist.",
    });
    revalidateShortlist(assignment.source_shortlist_id);
  }
  if (assignment.campaign_header_id) {
    revalidatePath(`/campaigns/${assignment.campaign_header_id}`);
  }
  return { ok: true, message: "Creator returned to the original shortlist." };
}

export async function removeAssignmentPermanently(
  assignmentId: string
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const assignment = await loadAssignment(actor.supabase, assignmentId);
  if (!assignment) return { ok: false, message: "Assignment not found." };

  const { error } = await actor.supabase
    .from("campaign_influencers")
    .update({
      shortlist_assignment_status: "removed" as CampaignShortlistAssignmentStatus,
      status: "cancelled",
    } as never)
    .eq("id", assignmentId);
  if (error) return { ok: false, message: error.message };

  // Remove from the originating shortlist so it does not reappear.
  if (assignment.source_shortlist_item_id) {
    await actor.supabase
      .from("discovery_shortlist_items")
      .delete()
      .eq("id", assignment.source_shortlist_item_id);
  }

  await logCreatorMovement(actor.supabase, {
    action: "campaign_to_removed",
    sourceType: "campaign",
    sourceId: assignment.campaign_header_id,
    destinationType: "removed",
    destinationId: null,
    performedBy: actor.userId,
    influencerId: assignment.influencer_id,
    notes: "Removed permanently from campaign and shortlist.",
  });

  if (assignment.source_shortlist_id) revalidateShortlist(assignment.source_shortlist_id);
  if (assignment.campaign_header_id) {
    revalidatePath(`/campaigns/${assignment.campaign_header_id}`);
  }
  return { ok: true, message: "Creator removed permanently." };
}
