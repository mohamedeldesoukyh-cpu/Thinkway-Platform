import type { SupabaseClient } from "@supabase/supabase-js";

import type { AssignmentPricingMode } from "@/features/campaigns/line-assignment";
import type { Database } from "@/types/database";

type CampaignLineInsert = Database["public"]["Tables"]["campaign_lines"]["Insert"];

type SourceCampaignLine = Record<string, unknown> & {
  id: string;
  name: string;
  platform: string | null;
  metadata: Record<string, unknown>;
  sort_order?: number;
};

function money(value: unknown, copyPricing: boolean): number {
  if (!copyPricing) return 0;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Builds a fresh campaign_lines insert row from a source line (billing state reset). */
export function buildDuplicatedCampaignLineInsert(
  line: SourceCampaignLine,
  input: {
    campaignHeaderId: string;
    startDate: string;
    endDate: string | null;
    copyPricing: boolean;
    createdBy: string;
  }
): CampaignLineInsert {
  const copy = input.copyPricing;

  return {
    campaign_header_id: input.campaignHeaderId,
    name: line.name,
    status: "draft",
    assignment_status: "assigned",
    platform: line.platform,
    po_amount: money(line.po_amount, copy),
    revenue_before_vat: money(line.revenue_before_vat ?? line.revenue, copy),
    usage_rights_amount: money(line.usage_rights_amount, copy),
    usage_rights_cost: money(line.usage_rights_cost, copy),
    agency_fee_percent: money(line.agency_fee_percent, copy),
    agency_fee_amount: money(line.agency_fee_amount, copy),
    revenue_vat_percent: money(line.revenue_vat_percent, copy),
    revenue_vat_exempt: Boolean(line.revenue_vat_exempt),
    cost_received: copy
      ? line.cost_received != null
        ? money(line.cost_received, true)
        : money(line.cost_before_vat ?? line.cost, true)
      : 0,
    cost_received_currency: copy
      ? (line.cost_received_currency as string | null) ??
        (line.fx_from_currency as string | null) ??
        (line.currency_code as string)
      : (line.currency_code as string),
    cost_before_vat: money(line.cost_before_vat ?? line.cost, copy),
    cost_vat_percent: money(line.cost_vat_percent, copy),
    cost_vat_exempt: Boolean(line.cost_vat_exempt),
    po_consumed: 0,
    billing_status: "draft",
    operational_status: "draft",
    revenue_locked: false,
    cost_locked: false,
    vendor_assignment_locked: false,
    vat_locked: false,
    invoice_id: null,
    vendor_io_id: null,
    finance_override_until: null,
    currency_code: String(line.currency_code ?? ""),
    base_currency: String(line.base_currency ?? ""),
    fx_rate: money(line.fx_rate, true) || 1,
    fx_from_currency: (line.fx_from_currency as string | null) ?? null,
    fx_to_currency: (line.fx_to_currency as string | null) ?? null,
    fx_snapshot_at: copy ? (line.fx_snapshot_at as string | null) ?? null : null,
    pricing_mode: (line.pricing_mode as AssignmentPricingMode | undefined) ?? "package",
    sort_order: Number(line.sort_order ?? 0),
    start_date: input.startDate,
    end_date: input.endDate,
    metadata: line.metadata ?? {},
    created_by: input.createdBy,
  };
}

type SourceDeliverable = Record<string, unknown> & {
  id: string;
  campaign_line_id: string;
};

type SourcePostSchedule = Record<string, unknown> & {
  assignment_deliverable_id: string;
  campaign_line_id: string;
};

/** Copies assignment_deliverables and post schedules onto duplicated lines. */
export async function copyAssignmentDeliverablesForDuplicate(
  supabase: SupabaseClient,
  input: {
    sourceLineIds: string[];
    lineIdMap: Map<string, string>;
    newHeaderId: string;
    copyPricing: boolean;
  }
): Promise<void> {
  if (input.sourceLineIds.length === 0) return;

  const { data: deliverables, error: deliverablesError } = await supabase
    .from("assignment_deliverables")
    .select("*")
    .in("campaign_line_id", input.sourceLineIds)
    .order("sort_order");

  if (deliverablesError) {
    throw new Error(deliverablesError.message);
  }

  const deliverableIdMap = new Map<string, string>();
  const copy = input.copyPricing;

  for (const row of (deliverables ?? []) as SourceDeliverable[]) {
    const newLineId = input.lineIdMap.get(row.campaign_line_id as string);
    if (!newLineId) continue;

    const billable = money(row.billable_amount, copy);
    const { data: inserted, error } = await supabase
      .from("assignment_deliverables")
      .insert({
        campaign_header_id: input.newHeaderId,
        campaign_line_id: newLineId,
        sort_order: Number(row.sort_order ?? 0),
        platform: row.platform,
        deliverable_type: row.deliverable_type,
        quantity: Number(row.quantity ?? 1),
        unit_cost: money(row.unit_cost, copy),
        total_cost: money(row.total_cost, copy),
        revenue_before_vat: money(row.revenue_before_vat, copy),
        usage_rights_amount: money(row.usage_rights_amount, copy),
        usage_rights_cost: money(row.usage_rights_cost, copy),
        agency_fee_percent: money(row.agency_fee_percent, copy),
        agency_fee_amount: money(row.agency_fee_amount, copy),
        revenue_vat_percent: money(row.revenue_vat_percent, copy),
        revenue_vat_amount: money(row.revenue_vat_amount, copy),
        revenue_after_vat: money(row.revenue_after_vat, copy),
        revenue_vat_exempt: Boolean(row.revenue_vat_exempt),
        cost_before_vat: money(row.cost_before_vat, copy),
        cost_vat_percent: money(row.cost_vat_percent, copy),
        cost_vat_amount: money(row.cost_vat_amount, copy),
        cost_after_vat: money(row.cost_after_vat, copy),
        cost_vat_exempt: Boolean(row.cost_vat_exempt),
        live_date: (row.live_date as string | null) ?? null,
        schedule_mode: (row.schedule_mode as string | null) ?? "single",
        notes: (row.notes as string | null) ?? null,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        billable_amount: billable,
        invoiced_amount: 0,
        collected_amount: 0,
        disputed_amount: 0,
        remaining_amount: billable,
        billing_status: "draft",
        invoice_line_item_id: null,
        invoiced_at: null,
        locked_at: null,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      throw new Error(error?.message ?? "Failed to copy assignment deliverable.");
    }

    deliverableIdMap.set(row.id, inserted.id);
  }

  const sourceDeliverableIds = [...deliverableIdMap.keys()];
  if (sourceDeliverableIds.length === 0) return;

  const { data: schedules, error: schedulesError } = await supabase
    .from("assignment_post_schedule")
    .select("*")
    .in("assignment_deliverable_id", sourceDeliverableIds)
    .order("sequence_number");

  if (schedulesError) {
    throw new Error(schedulesError.message);
  }

  type PostScheduleInsert = {
    assignment_deliverable_id: string;
    campaign_line_id: string;
    sequence_number: number;
    live_date: string | null;
    status: string;
    notes: string | null;
    proof_url: null;
    metadata: Record<string, unknown>;
    revenue_before_vat: number;
    cost_before_vat: number;
    revenue_vat_percent: number;
    revenue_vat_amount: number;
    cost_vat_percent: number;
    cost_vat_amount: number;
    billing_status: string;
    billable_amount: number;
    invoiced_amount: number;
    collected_amount: number;
    remaining_amount: number;
    invoice_line_item_id: null;
    invoiced_at: null;
    locked_at: null;
  };

  const schedulePayload: PostScheduleInsert[] = [];
  for (const sched of (schedules ?? []) as SourcePostSchedule[]) {
    const newDeliverableId = deliverableIdMap.get(
      sched.assignment_deliverable_id as string
    );
    const newLineId = input.lineIdMap.get(sched.campaign_line_id as string);
    if (!newDeliverableId || !newLineId) continue;

    const billable = money(sched.billable_amount, copy);
    schedulePayload.push({
      assignment_deliverable_id: newDeliverableId,
      campaign_line_id: newLineId,
      sequence_number: Number(sched.sequence_number ?? 1),
      live_date: (sched.live_date as string | null) ?? null,
      status: "draft",
      notes: (sched.notes as string | null) ?? null,
      proof_url: null,
      metadata: (sched.metadata as Record<string, unknown>) ?? {},
      revenue_before_vat: money(sched.revenue_before_vat, copy),
      cost_before_vat: money(sched.cost_before_vat, copy),
      revenue_vat_percent: money(sched.revenue_vat_percent, copy),
      revenue_vat_amount: money(sched.revenue_vat_amount, copy),
      cost_vat_percent: money(sched.cost_vat_percent, copy),
      cost_vat_amount: money(sched.cost_vat_amount, copy),
      billing_status: "draft",
      billable_amount: billable,
      invoiced_amount: 0,
      collected_amount: 0,
      remaining_amount: billable,
      invoice_line_item_id: null,
      invoiced_at: null,
      locked_at: null,
    });
  }

  if (schedulePayload.length > 0) {
    const { error } = await supabase
      .from("assignment_post_schedule")
      .insert(schedulePayload);
    if (error) {
      throw new Error(error.message);
    }
  }
}
