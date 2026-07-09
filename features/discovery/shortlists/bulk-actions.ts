"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, ShortlistItemStatus } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import { describeBulkOutcome } from "./bulk-selection-policy";
import {
  assertItemTransition,
  canBulkApproveItem,
  canBulkCancelItem,
  canBulkRejectItem,
  canRemoveItem,
  canSubmitItemForReview,
} from "./item-transitions";
import { SHORTLIST_PERMISSIONS } from "./constants";
import { logCreatorMovement } from "./movements";
import type { ActionResult } from "./types";
import { canEditCreators } from "./transitions";

type Supabase = SupabaseClient<Database>;

async function getActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, SHORTLIST_PERMISSIONS.write);
  if ("error" in auth) {
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
      message: "Only a Team Leader or Admin can approve or reject creators.",
    };
  }
  return { ok: true, supabase, userId: auth.userId };
}

async function loadItems(
  supabase: Supabase,
  shortlistId: string,
  itemIds: string[]
) {
  const { data, error } = await supabase
    .from("discovery_shortlist_items")
    .select("id, item_status, profile_id, influencer_id, unified_id")
    .eq("shortlist_id", shortlistId)
    .in("id", itemIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    item_status: ShortlistItemStatus;
    profile_id: string | null;
    influencer_id: string | null;
    unified_id: string | null;
  }>;
}

async function loadShortlistStatus(supabase: Supabase, shortlistId: string) {
  const { data } = await supabase
    .from("discovery_shortlists")
    .select("id, status")
    .eq("id", shortlistId)
    .maybeSingle();
  return data as { id: string; status: Database["public"]["Tables"]["discovery_shortlists"]["Row"]["status"] } | null;
}

function revalidate(shortlistId: string) {
  revalidatePath("/discovery/shortlists");
  revalidatePath(`/discovery/shortlists/${shortlistId}`);
}

/** Submit selected draft creators for review (sets item_status → under_review). */
export async function bulkSubmitCreatorsForReview(
  shortlistId: string,
  itemIds: string[]
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  if (!itemIds.length) return { ok: false, message: "Select at least one creator." };

  const shortlist = await loadShortlistStatus(actor.supabase, shortlistId);
  if (!shortlist) return { ok: false, message: "Shortlist not found." };
  if (!canEditCreators(shortlist.status)) {
    return { ok: false, message: "Creators cannot be submitted in the current shortlist status." };
  }

  const items = await loadItems(actor.supabase, shortlistId, itemIds);
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    if (!canSubmitItemForReview(item.item_status)) {
      skipped += 1;
      continue;
    }
    try {
      assertItemTransition(item.item_status, "under_review");
    } catch {
      skipped += 1;
      continue;
    }
    const { error } = await actor.supabase
      .from("discovery_shortlist_items")
      .update({ item_status: "under_review" } as never)
      .eq("id", item.id);
    if (error) return { ok: false, message: error.message };
    updated += 1;
  }

  if (updated === 0) {
    return { ok: false, message: describeBulkOutcome({ action: "submitted", requested: itemIds.length, updated, skipped }) };
  }

  revalidate(shortlistId);
  return {
    ok: true,
    message: describeBulkOutcome({ action: "submitted for review", requested: itemIds.length, updated, skipped }),
  };
}

/** Remove multiple creators from a shortlist. */
export async function bulkRemoveCreatorsFromShortlist(
  shortlistId: string,
  itemIds: string[]
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  if (!itemIds.length) return { ok: false, message: "Select at least one creator." };

  const shortlist = await loadShortlistStatus(actor.supabase, shortlistId);
  if (!shortlist) return { ok: false, message: "Shortlist not found." };
  if (!canEditCreators(shortlist.status)) {
    return { ok: false, message: "Creators can only be removed while the shortlist is editable." };
  }

  const items = await loadItems(actor.supabase, shortlistId, itemIds);
  let removed = 0;
  let skipped = 0;

  for (const item of items) {
    if (!canRemoveItem(item.item_status)) {
      skipped += 1;
      continue;
    }
    const { error } = await actor.supabase
      .from("discovery_shortlist_items")
      .delete()
      .eq("id", item.id)
      .eq("shortlist_id", shortlistId);
    if (error) return { ok: false, message: error.message };

    await logCreatorMovement(actor.supabase, {
      action: "creator_removed",
      sourceType: "shortlist",
      sourceId: shortlistId,
      destinationType: "removed",
      destinationId: null,
      performedBy: actor.userId,
      influencerId: item.influencer_id,
      discoveredProfileId: item.profile_id,
      unifiedId: item.unified_id,
      notes: "Bulk removed from shortlist.",
    });
    removed += 1;
  }

  if (removed === 0) {
    return { ok: false, message: describeBulkOutcome({ action: "removed", requested: itemIds.length, updated: removed, skipped }) };
  }

  revalidate(shortlistId);
  return {
    ok: true,
    message: describeBulkOutcome({ action: "removed", requested: itemIds.length, updated: removed, skipped }),
  };
}

async function bulkSetItemStatus(input: {
  shortlistId: string;
  itemIds: string[];
  toStatus: ShortlistItemStatus;
  requireApprover?: boolean;
  actionLabel: string;
  movementNotes?: string;
}): Promise<ActionResult> {
  const actor = input.requireApprover ? await requireApprover() : await getActor();
  if (!actor.ok) return actor;
  if (!input.itemIds.length) return { ok: false, message: "Select at least one creator." };

  const items = await loadItems(actor.supabase, input.shortlistId, input.itemIds);
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const allowed =
      input.toStatus === "approved"
        ? canBulkApproveItem(item.item_status)
        : input.toStatus === "rejected"
          ? canBulkRejectItem(item.item_status)
          : input.toStatus === "cancelled"
            ? canBulkCancelItem(item.item_status)
            : false;

    if (!allowed) {
      skipped += 1;
      continue;
    }
    try {
      assertItemTransition(item.item_status, input.toStatus);
    } catch {
      skipped += 1;
      continue;
    }

    const { error } = await actor.supabase
      .from("discovery_shortlist_items")
      .update({ item_status: input.toStatus } as never)
      .eq("id", item.id);
    if (error) return { ok: false, message: error.message };
    updated += 1;
  }

  if (updated === 0) {
    return {
      ok: false,
      message: describeBulkOutcome({
        action: input.actionLabel,
        requested: input.itemIds.length,
        updated,
        skipped,
      }),
    };
  }

  revalidate(input.shortlistId);
  return {
    ok: true,
    message: describeBulkOutcome({
      action: input.actionLabel,
      requested: input.itemIds.length,
      updated,
      skipped,
    }),
  };
}

export async function bulkApproveCreators(
  shortlistId: string,
  itemIds: string[]
): Promise<ActionResult> {
  return bulkSetItemStatus({
    shortlistId,
    itemIds,
    toStatus: "approved",
    requireApprover: true,
    actionLabel: "approved",
  });
}

export async function bulkRejectCreators(
  shortlistId: string,
  itemIds: string[]
): Promise<ActionResult> {
  return bulkSetItemStatus({
    shortlistId,
    itemIds,
    toStatus: "rejected",
    requireApprover: true,
    actionLabel: "rejected",
  });
}

export async function bulkCancelCreators(
  shortlistId: string,
  itemIds: string[]
): Promise<ActionResult> {
  return bulkSetItemStatus({
    shortlistId,
    itemIds,
    toStatus: "cancelled",
    actionLabel: "cancelled",
  });
}

/** Submit entire shortlist: header → under_review + all draft items → under_review. */
export async function submitEntireShortlistForReview(
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

  const { submitShortlistForReview } = await import("./actions");
  const result = await submitShortlistForReview(shortlistId);
  if (!result.ok) return result;

  await actor.supabase
    .from("discovery_shortlist_items")
    .update({ item_status: "under_review" } as never)
    .eq("shortlist_id", shortlistId)
    .eq("item_status", "draft");

  revalidate(shortlistId);
  return { ok: true, message: "Entire shortlist submitted for review." };
}
