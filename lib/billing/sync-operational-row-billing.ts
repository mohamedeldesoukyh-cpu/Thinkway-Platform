import type { SupabaseClient } from "@supabase/supabase-js";

import { syncLineBillingFromDeliverables } from "@/lib/billing/sync-deliverable-billing";

const READY_STATUS = "ready_to_invoice";
const DRAFT_STATUS = "draft";

export type OperationalRowTarget = {
  lineIds: string[];
  deliverableIds: string[];
  postIds: string[];
};

/** Marks selected deliverables and posts as ready to invoice without moving whole assignments. */
export async function markOperationalRowsReadyToInvoice(
  supabase: SupabaseClient,
  campaignId: string,
  targets: OperationalRowTarget
): Promise<{ updated: number; error?: string }> {
  let updated = 0;
  const touchedLineIds = new Set<string>();

  if (targets.postIds.length > 0) {
    const { data: posts, error } = await supabase
      .from("assignment_post_schedule")
      .select("id, campaign_line_id, locked_at, invoice_line_item_id")
      .in("id", targets.postIds);

    if (error) {
      return { updated: 0, error: error.message };
    }

    for (const post of posts ?? []) {
      if (post.locked_at || post.invoice_line_item_id) continue;
      const { error: updateError } = await supabase
        .from("assignment_post_schedule")
        .update({ billing_status: READY_STATUS })
        .eq("id", post.id);
      if (!updateError) {
        updated += 1;
        touchedLineIds.add(post.campaign_line_id);
      }
    }
  }

  if (targets.deliverableIds.length > 0) {
    const { data: deliverables, error } = await supabase
      .from("assignment_deliverables")
      .select("id, campaign_line_id, locked_at")
      .eq("campaign_header_id", campaignId)
      .in("id", targets.deliverableIds);

    if (error) {
      return { updated, error: error.message };
    }

    for (const row of deliverables ?? []) {
      if (row.locked_at) continue;
      const { error: updateError } = await supabase
        .from("assignment_deliverables")
        .update({ billing_status: READY_STATUS })
        .eq("id", row.id)
        .in("billing_status", [DRAFT_STATUS, READY_STATUS]);
      if (!updateError) {
        updated += 1;
        touchedLineIds.add(row.campaign_line_id);
      }
    }
  }

  await syncTouchedAssignmentLines(supabase, touchedLineIds);

  if (process.env.NODE_ENV === "development") {
    console.debug("[operational-row-billing] move rows ready", {
      campaignId,
      updated,
      postIds: targets.postIds,
      deliverableIds: targets.deliverableIds,
      touchedLineIds: [...touchedLineIds],
    });
  }

  return { updated };
}

/** Approves selected operational rows at deliverable/post granularity. */
export async function approveOperationalRows(
  supabase: SupabaseClient,
  campaignId: string,
  targets: OperationalRowTarget
): Promise<{ updated: number; error?: string }> {
  let updated = 0;
  const touchedLineIds = new Set<string>();

  if (targets.postIds.length > 0) {
    const { data: posts, error } = await supabase
      .from("assignment_post_schedule")
      .select("id, campaign_line_id")
      .in("id", targets.postIds);

    if (error) {
      return { updated: 0, error: error.message };
    }

    for (const post of posts ?? []) {
      const { error: updateError } = await supabase
        .from("assignment_post_schedule")
        .update({ billing_status: READY_STATUS })
        .eq("id", post.id);
      if (!updateError) {
        updated += 1;
        touchedLineIds.add(post.campaign_line_id);
      }
    }
  }

  if (targets.deliverableIds.length > 0) {
    const { data: deliverables, error } = await supabase
      .from("assignment_deliverables")
      .select("id, campaign_line_id")
      .eq("campaign_header_id", campaignId)
      .in("id", targets.deliverableIds);

    if (error) {
      return { updated, error: error.message };
    }

    for (const row of deliverables ?? []) {
      const { error: updateError } = await supabase
        .from("assignment_deliverables")
        .update({ billing_status: READY_STATUS })
        .eq("id", row.id)
        .eq("billing_status", DRAFT_STATUS);
      if (!updateError) {
        updated += 1;
        touchedLineIds.add(row.campaign_line_id);
      }
    }
  }

  await syncTouchedAssignmentLines(supabase, touchedLineIds);

  if (process.env.NODE_ENV === "development") {
    console.debug("[operational-row-billing] partial approve", {
      campaignId,
      updated,
      postIds: targets.postIds,
      deliverableIds: targets.deliverableIds,
    });
  }

  return { updated };
}

async function syncTouchedAssignmentLines(
  supabase: SupabaseClient,
  lineIds: Set<string>
): Promise<void> {
  for (const lineId of lineIds) {
    const { data: line } = await supabase
      .from("campaign_lines")
      .select("billing_status")
      .eq("id", lineId)
      .maybeSingle();
    await syncLineBillingFromDeliverables(
      supabase,
      lineId,
      line?.billing_status ?? "draft"
    );
  }
}

export function resolveBulkBillingTargets(parsed: {
  line_ids: string[];
  deliverable_ids: string[];
  post_ids: string[];
}): OperationalRowTarget & { hasGranularSelection: boolean } {
  const hasGranularSelection =
    parsed.deliverable_ids.length > 0 || parsed.post_ids.length > 0;

  return {
    lineIds: parsed.line_ids,
    deliverableIds: parsed.deliverable_ids,
    postIds: parsed.post_ids,
    hasGranularSelection,
  };
}
