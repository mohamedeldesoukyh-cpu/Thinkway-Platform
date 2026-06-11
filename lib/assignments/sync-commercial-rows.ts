import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CommercialDeliverableRow,
  PostScheduleEntry,
} from "@/lib/assignments/commercial-calculations";
import { computeClientBilling } from "@/lib/assignments/client-billing-commercial";
import {
  expandPostSchedules,
  rowTotalCost,
  rowTotalRevenue,
} from "@/lib/assignments/commercial-calculations";
import { computeVatLine } from "@/lib/vat/calculations";

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
  const { data: lockedRows } = await supabase
    .from("assignment_deliverables")
    .select("id, metadata")
    .eq("campaign_line_id", input.campaignLineId)
    .not("locked_at", "is", null);

  const lockedClientIds = new Set(
    (lockedRows ?? [])
      .map((r) => (r.metadata as { client_row_id?: string })?.client_row_id)
      .filter(Boolean)
  );

  await supabase
    .from("assignment_deliverables")
    .delete()
    .eq("campaign_line_id", input.campaignLineId)
    .is("locked_at", null);

  for (let index = 0; index < input.rows.length; index++) {
    const row = input.rows[index];
    if (lockedClientIds.has(row.id)) {
      continue;
    }
    const costBeforeVat = rowTotalCost(row);
    const revenueBeforeVat = rowTotalRevenue(row);
    const billing = computeClientBilling({
      revenueBeforeVat,
      usageRightsAmount: row.usage_rights_amount,
      agencyFeePercent: row.agency_fee_percent,
      vatPercent: input.revenueVatExempt ? 0 : input.revenueVatPercent,
      vatExempt: input.revenueVatExempt,
      costBeforeVat,
    });
    const cost = computeVatLine({
      beforeVat: costBeforeVat,
      vatPercent: input.costVatExempt ? 0 : input.costVatPercent,
      exempt: input.costVatExempt,
    });

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
        revenue_before_vat: billing.revenueBeforeVat,
        usage_rights_amount: billing.usageRightsAmount,
        agency_fee_percent: billing.agencyFeePercent,
        agency_fee_amount: billing.agencyFeeAmount,
        revenue_vat_percent: billing.vatPercent,
        revenue_vat_amount: billing.vatAmount,
        revenue_after_vat: billing.totalBilling,
        cost_before_vat: cost.beforeVat,
        cost_vat_percent: cost.vatPercent,
        cost_vat_amount: cost.vatAmount,
        cost_after_vat: cost.afterVat,
        live_date: row.live_date,
        schedule_mode: row.schedule_mode,
        notes: row.notes,
        metadata: { client_row_id: row.id },
        revenue_vat_exempt: input.revenueVatExempt,
        cost_vat_exempt: input.costVatExempt,
        billable_amount: billing.taxableBase,
        remaining_amount: billing.taxableBase,
        billing_status: "draft",
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
