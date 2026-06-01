import type { SupabaseClient } from "@supabase/supabase-js";

import { syncLineCommercialRollupsFromDeliverables } from "@/lib/assignments/sync-line-rollups";
import { computeVatLine } from "@/lib/vat/calculations";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type DeliverableContext = {
  id: string;
  campaign_line_id: string;
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
};

type LineVat = {
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
  cost_vat_percent: number;
  cost_vat_exempt: boolean;
};

function perPostAmount(total: number, quantity: number): number {
  if (quantity <= 0) return roundMoney(total);
  return roundMoney(total / quantity);
}

function computePostCommercial(
  revenuePerPost: number,
  costPerPost: number,
  line: LineVat
) {
  const revenue = computeVatLine({
    beforeVat: revenuePerPost,
    vatPercent: line.revenue_vat_exempt ? 0 : line.revenue_vat_percent,
    exempt: line.revenue_vat_exempt,
  });
  const cost = computeVatLine({
    beforeVat: costPerPost,
    vatPercent: line.cost_vat_exempt ? 0 : line.cost_vat_percent,
    exempt: line.cost_vat_exempt,
  });
  return {
    revenue_before_vat: revenue.beforeVat,
    revenue_vat_percent: revenue.vatPercent,
    revenue_vat_amount: revenue.vatAmount,
    cost_before_vat: cost.beforeVat,
    cost_vat_percent: cost.vatPercent,
    cost_vat_amount: cost.vatAmount,
  };
}

/** Ensures assignment_post_schedule rows match deliverable quantity with per-post commercial defaults. */
export async function syncPostSchedulesForDeliverable(
  supabase: SupabaseClient,
  deliverable: DeliverableContext,
  line: LineVat
): Promise<void> {
  const quantity = Math.max(1, deliverable.quantity);
  const unitRevenue = perPostAmount(deliverable.revenue_before_vat, quantity);
  const unitCost = perPostAmount(deliverable.cost_before_vat, quantity);

  const { data: existing } = await supabase
    .from("assignment_post_schedule")
    .select("id, sequence_number")
    .eq("assignment_deliverable_id", deliverable.id)
    .order("sequence_number");

  const rows = existing ?? [];

  if (rows.length > quantity) {
    const toRemove = rows.slice(quantity).map((r) => r.id);
    await supabase.from("assignment_post_schedule").delete().in("id", toRemove);
  }

  if (rows.length < quantity) {
    const commercial = computePostCommercial(unitRevenue, unitCost, line);
    const inserts = [];
    for (let seq = rows.length + 1; seq <= quantity; seq++) {
      inserts.push({
        assignment_deliverable_id: deliverable.id,
        campaign_line_id: deliverable.campaign_line_id,
        sequence_number: seq,
        live_date: deliverable.live_date,
        status: "draft" as const,
        notes: deliverable.notes,
        billing_status: deliverable.billing_status ?? "draft",
        ...commercial,
      });
    }
    if (inserts.length > 0) {
      await supabase.from("assignment_post_schedule").insert(inserts);
    }
  }
}

/** Rolls assignment_deliverables totals up from post schedule rows. */
export async function syncDeliverableRollupFromPosts(
  supabase: SupabaseClient,
  deliverableId: string,
  line: LineVat
): Promise<void> {
  const { data: posts, error: postsError } = await supabase
    .from("assignment_post_schedule")
    .select(
      "revenue_before_vat, cost_before_vat, revenue_vat_amount, cost_vat_amount, billing_status"
    )
    .eq("assignment_deliverable_id", deliverableId)
    .order("sequence_number");

  if (postsError) {
    throw new Error(postsError.message);
  }

  const rows = posts ?? [];
  if (rows.length === 0) return;

  const revenueBeforeVat = roundMoney(
    rows.reduce((sum, row) => sum + Number(row.revenue_before_vat), 0)
  );
  const costBeforeVat = roundMoney(
    rows.reduce((sum, row) => sum + Number(row.cost_before_vat), 0)
  );
  const revenueVatAmount = roundMoney(
    rows.reduce((sum, row) => sum + Number(row.revenue_vat_amount), 0)
  );
  const costVatAmount = roundMoney(
    rows.reduce((sum, row) => sum + Number(row.cost_vat_amount), 0)
  );

  const revenue = computeVatLine({
    beforeVat: revenueBeforeVat,
    vatPercent: line.revenue_vat_exempt ? 0 : line.revenue_vat_percent,
    exempt: line.revenue_vat_exempt,
  });
  const cost = computeVatLine({
    beforeVat: costBeforeVat,
    vatPercent: line.cost_vat_exempt ? 0 : line.cost_vat_percent,
    exempt: line.cost_vat_exempt,
  });

  const quantity = rows.length;
  const unitCost = quantity > 0 ? roundMoney(costBeforeVat / quantity) : 0;

  const { data: deliverable } = await supabase
    .from("assignment_deliverables")
    .select("invoiced_amount, locked_at, campaign_line_id")
    .eq("id", deliverableId)
    .maybeSingle();

  const invoicedAmount = Number(deliverable?.invoiced_amount ?? 0);
  const remainingAmount = Math.max(0, revenueBeforeVat - invoicedAmount);

  const billingStatuses = rows.map((r) => r.billing_status);
  let billingStatus = "draft";
  if (billingStatuses.every((s) => s === "invoiced" || s === "collected")) {
    billingStatus = billingStatuses.every((s) => s === "collected")
      ? "collected"
      : "invoiced";
  } else if (billingStatuses.some((s) => s === "invoiced" || s === "partially_invoiced")) {
    billingStatus = "partially_invoiced";
  } else if (billingStatuses.every((s) => s === "ready_to_invoice")) {
    billingStatus = "ready_to_invoice";
  }

  await supabase
    .from("assignment_deliverables")
    .update({
      quantity,
      unit_cost: unitCost,
      total_cost: costBeforeVat,
      cost_before_vat: costBeforeVat,
      cost_vat_amount: costVatAmount,
      cost_after_vat: cost.afterVat,
      revenue_before_vat: revenueBeforeVat,
      revenue_vat_amount: revenueVatAmount,
      revenue_after_vat: revenue.afterVat,
      billable_amount: revenueBeforeVat,
      remaining_amount: deliverable?.locked_at ? remainingAmount : revenueBeforeVat - invoicedAmount,
      billing_status: billingStatus,
      schedule_mode: quantity > 1 ? "expanded" : "single",
    })
    .eq("id", deliverableId);

  if (deliverable?.campaign_line_id) {
    await syncLineCommercialRollupsFromDeliverables(
      supabase,
      deliverable.campaign_line_id
    );
  }
}

export async function loadLineVatForDeliverable(
  supabase: SupabaseClient,
  campaignLineId: string
): Promise<LineVat> {
  const { data, error } = await supabase
    .from("campaign_lines")
    .select(
      "revenue_vat_percent, revenue_vat_exempt, cost_vat_percent, cost_vat_exempt"
    )
    .eq("id", campaignLineId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Campaign line not found.");
  }

  return {
    revenue_vat_percent: Number(data.revenue_vat_percent ?? 0),
    revenue_vat_exempt: data.revenue_vat_exempt ?? false,
    cost_vat_percent: Number(data.cost_vat_percent ?? 0),
    cost_vat_exempt: data.cost_vat_exempt ?? false,
  };
}
