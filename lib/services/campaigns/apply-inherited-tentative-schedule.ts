import type { SupabaseClient } from "@supabase/supabase-js";

import { syncPostSchedulesForDeliverable } from "@/lib/assignments/sync-post-schedules";
import {
  buildTentativeExecutionMetadata,
  mergeExecutionScheduleMetadata,
} from "@/lib/campaigns/execution-schedule-metadata";
import {
  resolveHintForDeliverable,
  resolveOperationalLiveDate,
  type ExecutionDeliverableScheduleHint,
} from "@/lib/domains/commercial/campaign-execution-schedule-inheritance";

type DeliverableRow = {
  id: string;
  campaign_line_id: string;
  platform: string;
  deliverable_type: string;
  quantity: number;
  unit_cost: number;
  revenue_before_vat: number;
  cost_before_vat: number;
  revenue_vat_percent: number;
  revenue_vat_amount: number;
  cost_vat_percent: number;
  cost_vat_amount: number;
  revenue_vat_exempt: boolean;
  cost_vat_exempt: boolean;
  live_date: string | null;
  notes: string | null;
  billing_status: string;
  locked_at: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * Apply inherited tentative posting schedule to assignment deliverables on a line.
 * Operational SSOT from this point — no sync back to Campaign Plan or quotation.
 */
export async function applyInheritedTentativeScheduleToLine(
  supabase: SupabaseClient,
  input: {
    campaignLineId: string;
    scheduleHints: ExecutionDeliverableScheduleHint[];
    fallbackLiveDate?: string | null;
  }
): Promise<{ updatedDeliverables: number; updatedPosts: number }> {
  if (input.scheduleHints.length === 0) {
    return { updatedDeliverables: 0, updatedPosts: 0 };
  }

  const { data: deliverables, error } = await supabase
    .from("assignment_deliverables")
    .select(
      "id, campaign_line_id, platform, deliverable_type, quantity, unit_cost, revenue_before_vat, cost_before_vat, revenue_vat_percent, revenue_vat_amount, cost_vat_percent, cost_vat_amount, revenue_vat_exempt, cost_vat_exempt, live_date, notes, billing_status, locked_at, metadata"
    )
    .eq("campaign_line_id", input.campaignLineId)
    .order("sort_order");

  if (error || !deliverables?.length) {
    return { updatedDeliverables: 0, updatedPosts: 0 };
  }

  const usedHintIndexes = new Set<number>();
  let updatedDeliverables = 0;
  let updatedPosts = 0;

  for (const row of deliverables as DeliverableRow[]) {
    if (row.locked_at) continue;

    const hint = resolveHintForDeliverable(
      input.scheduleHints,
      row.platform,
      row.deliverable_type,
      usedHintIndexes
    );

    if (!hint?.tentative_posting_date && !hint?.tentative_posting_label) {
      continue;
    }

    const liveDate = resolveOperationalLiveDate(hint, input.fallbackLiveDate ?? null);
    const scheduleMeta = buildTentativeExecutionMetadata(hint);
    const metadata = mergeExecutionScheduleMetadata(row.metadata, scheduleMeta);

    const { error: updateError } = await supabase
      .from("assignment_deliverables")
      .update({
        live_date: liveDate,
        metadata,
      })
      .eq("id", row.id);

    if (updateError) continue;

    updatedDeliverables += 1;

    const deliverableContext: DeliverableRow = {
      ...row,
      live_date: liveDate,
      metadata,
    };

    await syncPostSchedulesForDeliverable(supabase, deliverableContext, {
      revenue_vat_percent: row.revenue_vat_percent,
      revenue_vat_exempt: row.revenue_vat_exempt,
      cost_vat_percent: row.cost_vat_percent,
      cost_vat_exempt: row.cost_vat_exempt,
    });

    const { data: posts } = await supabase
      .from("assignment_post_schedule")
      .select("id")
      .eq("assignment_deliverable_id", row.id);

    if (posts?.length) {
      await supabase
        .from("assignment_post_schedule")
        .update({
          live_date: liveDate,
          metadata: mergeExecutionScheduleMetadata(
            {},
            scheduleMeta
          ),
        })
        .eq("assignment_deliverable_id", row.id)
        .is("locked_at", null);

      updatedPosts += posts.length;
    }
  }

  return { updatedDeliverables, updatedPosts };
}
