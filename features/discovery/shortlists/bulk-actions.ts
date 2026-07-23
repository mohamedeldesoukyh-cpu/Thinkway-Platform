"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, ShortlistItemStatus } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import { COLLAPSE_CONTENT_LABEL } from "@/lib/discovery/collapse-content";
import {
  COLLAPSE_MIGRATION_HINT,
  isMissingCollapseColumnsError,
} from "@/lib/discovery/shortlist-item-collapse-select";

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

async function assertShortlistCreatorsEditable(
  supabase: Supabase,
  shortlistId: string
): Promise<ActionResult | { ok: true }> {
  const { data: shortlist, error: shortlistError } = await supabase
    .from("discovery_shortlists")
    .select("id, status, is_archived")
    .eq("id", shortlistId)
    .maybeSingle();

  if (shortlistError) return { ok: false, message: shortlistError.message };
  if (!shortlist) return { ok: false, message: "Shortlist not found." };
  if (shortlist.is_archived) {
    return { ok: false, message: "Archived shortlists cannot be edited." };
  }
  if (!canEditCreators(shortlist.status)) {
    return { ok: false, message: "This shortlist is locked and cannot be edited." };
  }
  return { ok: true };
}

/** Bundle two or more creators under a shared Collap content header. */
export async function collapseShortlistCreators(
  shortlistId: string,
  itemIds: string[]
): Promise<ActionResult> {
  if (itemIds.length < 2) {
    return { ok: false, message: "Select at least two creators to collapse content." };
  }

  const actor = await getActor();
  if (!actor.ok) return actor;

  const editable = await assertShortlistCreatorsEditable(actor.supabase, shortlistId);
  if (!editable.ok) return editable;

  const uniqueIds = [...new Set(itemIds)];
  if (uniqueIds.length < 2) {
    return { ok: false, message: "Select at least two distinct creators to collapse content." };
  }

  const { data: items, error: itemsError } = await actor.supabase
    .from("discovery_shortlist_items")
    .select("id, collapse_group_id")
    .eq("shortlist_id", shortlistId)
    .in("id", uniqueIds);

  if (itemsError) return { ok: false, message: itemsError.message };
  if (!items || items.length !== uniqueIds.length) {
    return { ok: false, message: "One or more selected creators were not found on this shortlist." };
  }

  const typedItems = items as Array<{ id: string; collapse_group_id: string | null }>;
  const existingGroupIds = [
    ...new Set(typedItems.map((item) => item.collapse_group_id).filter(Boolean)),
  ] as string[];

  if (existingGroupIds.length > 1) {
    return {
      ok: false,
      message: "Selected creators belong to different collapse groups. Uncollapse them first.",
    };
  }

  const ungroupedCount = typedItems.filter((item) => !item.collapse_group_id).length;
  if (existingGroupIds.length === 1 && ungroupedCount === 0) {
    return { ok: false, message: "These creators are already collapsed together." };
  }

  const collapseGroupId = existingGroupIds[0] ?? crypto.randomUUID();

  const { error: updateError } = await actor.supabase
    .from("discovery_shortlist_items")
    .update({
      collapse_group_id: collapseGroupId,
      collapse_label: COLLAPSE_CONTENT_LABEL,
    } as never)
    .eq("shortlist_id", shortlistId)
    .in("id", uniqueIds);

  if (updateError) {
    if (isMissingCollapseColumnsError(updateError.message)) {
      return { ok: false, message: COLLAPSE_MIGRATION_HINT };
    }
    return { ok: false, message: updateError.message };
  }

  revalidate(shortlistId);
  const count = uniqueIds.length;
  return {
    ok: true,
    message: `${count} creator${count === 1 ? "" : "s"} collapsed into Collap content.`,
  };
}

/** Remove selected creators from their collapse bundle. */
export async function uncollapseShortlistCreators(
  shortlistId: string,
  itemIds: string[]
): Promise<ActionResult> {
  if (itemIds.length === 0) {
    return { ok: false, message: "Select at least one collapsed creator to uncollapse." };
  }

  const actor = await getActor();
  if (!actor.ok) return actor;

  const editable = await assertShortlistCreatorsEditable(actor.supabase, shortlistId);
  if (!editable.ok) return editable;

  const uniqueIds = [...new Set(itemIds)];

  const { data: items, error: itemsError } = await actor.supabase
    .from("discovery_shortlist_items")
    .select("id, collapse_group_id")
    .eq("shortlist_id", shortlistId)
    .in("id", uniqueIds);

  if (itemsError) return { ok: false, message: itemsError.message };
  if (!items?.length) {
    return { ok: false, message: "No matching creators found on this shortlist." };
  }

  const collapsedIds = (items as Array<{ id: string; collapse_group_id: string | null }>)
    .filter((item) => item.collapse_group_id)
    .map((item) => item.id);

  if (collapsedIds.length === 0) {
    return { ok: false, message: "Selected creators are not part of a collapse bundle." };
  }

  const affectedGroupIds = [
    ...new Set(
      (items as Array<{ id: string; collapse_group_id: string | null }>)
        .map((item) => item.collapse_group_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const { error: updateError } = await actor.supabase
    .from("discovery_shortlist_items")
    .update({
      collapse_group_id: null,
      collapse_label: null,
    } as never)
    .eq("shortlist_id", shortlistId)
    .in("id", collapsedIds);

  if (updateError) {
    if (isMissingCollapseColumnsError(updateError.message)) {
      return { ok: false, message: COLLAPSE_MIGRATION_HINT };
    }
    return { ok: false, message: updateError.message };
  }

  for (const groupId of affectedGroupIds) {
    const { data: remaining } = await actor.supabase
      .from("discovery_shortlist_items")
      .select("id")
      .eq("shortlist_id", shortlistId)
      .eq("collapse_group_id", groupId);

    const remainingIds = ((remaining ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (remainingIds.length === 1) {
      await actor.supabase
        .from("discovery_shortlist_items")
        .update({
          collapse_group_id: null,
          collapse_label: null,
        } as never)
        .eq("id", remainingIds[0]!);
    }
  }

  revalidate(shortlistId);
  const count = collapsedIds.length;
  return {
    ok: true,
    message: `${count} creator${count === 1 ? "" : "s"} removed from Collap content.`,
  };
}
