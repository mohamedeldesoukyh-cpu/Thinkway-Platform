import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CommercialDeliverableRow,
  PostScheduleEntry,
} from "@/lib/assignments/commercial-calculations";
import {
  expandPostSchedules,
  rowTotalCost,
  rowTotalRevenue,
} from "@/lib/assignments/commercial-calculations";

export async function syncAssignmentCommercialRows(
  supabase: SupabaseClient,
  input: {
    campaignHeaderId: string;
    campaignLineId: string;
    rows: CommercialDeliverableRow[];
    revenueVatPercent: number;
    revenueVatExempt: boolean;
    costVatPercent: number;
    costVatExempt: boolean;
  }
) {
  await supabase
    .from("assignment_deliverables")
    .delete()
    .eq("campaign_line_id", input.campaignLineId);

  for (let index = 0; index < input.rows.length; index++) {
    const row = input.rows[index];
    const costBeforeVat = rowTotalCost(row);
    const revenueBeforeVat = rowTotalRevenue(row);
    const revenueVatAmount = input.revenueVatExempt
      ? 0
      : Math.round(revenueBeforeVat * input.revenueVatPercent) / 100;
    const costVatAmount = input.costVatExempt
      ? 0
      : Math.round(costBeforeVat * input.costVatPercent) / 100;

    const { data: inserted, error } = await supabase
      .from("assignment_deliverables")
      .insert({
        campaign_header_id: input.campaignHeaderId,
        campaign_line_id: input.campaignLineId,
        sort_order: index,
        platform: row.platform,
        deliverable_type: row.deliverable_type,
        quantity: row.quantity,
        unit_cost: row.unit_cost,
        total_cost: costBeforeVat,
        revenue_before_vat: revenueBeforeVat,
        revenue_vat_percent: input.revenueVatExempt ? 0 : input.revenueVatPercent,
        revenue_vat_amount: revenueVatAmount,
        revenue_after_vat: revenueBeforeVat + revenueVatAmount,
        cost_before_vat: costBeforeVat,
        cost_vat_percent: input.costVatExempt ? 0 : input.costVatPercent,
        cost_vat_amount: costVatAmount,
        cost_after_vat: costBeforeVat + costVatAmount,
        live_date: row.live_date,
        schedule_mode: row.schedule_mode,
        notes: row.notes,
        metadata: { client_row_id: row.id },
      })
      .select("id")
      .single();

    if (error || !inserted) {
      throw new Error(error?.message ?? "Failed to sync assignment deliverable row.");
    }

    const schedules = expandPostSchedules(row);
    if (schedules.length > 0) {
      await syncPostSchedules(supabase, {
        assignmentDeliverableId: inserted.id,
        campaignLineId: input.campaignLineId,
        schedules,
      });
    }
  }
}

async function syncPostSchedules(
  supabase: SupabaseClient,
  input: {
    assignmentDeliverableId: string;
    campaignLineId: string;
    schedules: PostScheduleEntry[];
  }
) {
  await supabase
    .from("assignment_post_schedule")
    .delete()
    .eq("assignment_deliverable_id", input.assignmentDeliverableId);

  const payload = input.schedules.map((s) => ({
    assignment_deliverable_id: input.assignmentDeliverableId,
    campaign_line_id: input.campaignLineId,
    sequence_number: s.sequence,
    live_date: s.live_date,
    status: (s.status ?? "draft") as "draft",
    notes: s.notes ?? null,
  }));

  if (payload.length > 0) {
    const { error } = await supabase.from("assignment_post_schedule").insert(payload);
    if (error) {
      throw new Error(error.message);
    }
  }
}
