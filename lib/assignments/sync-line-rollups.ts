import type { SupabaseClient } from "@supabase/supabase-js";

import { syncLineBillingFromDeliverables } from "@/lib/billing/sync-deliverable-billing";
import { computeOperationalGp } from "@/lib/vat/calculations";
import { buildLineVatPayload } from "@/lib/vat/line-payload";

type LineContext = {
  id: string;
  billing_status: string;
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
  cost_vat_percent: number;
  cost_vat_exempt: boolean;
  metadata: Record<string, unknown> | null;
};

type DeliverableRollupRow = {
  revenue_before_vat: number;
  cost_before_vat: number;
  quantity: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Recomputes campaign line commercial totals from assignment_deliverables children. */
export async function syncLineCommercialRollupsFromDeliverables(
  supabase: SupabaseClient,
  lineId: string
): Promise<void> {
  const { data: line, error: lineError } = await supabase
    .from("campaign_lines")
    .select(
      "id, billing_status, revenue_vat_percent, revenue_vat_exempt, cost_vat_percent, cost_vat_exempt, metadata"
    )
    .eq("id", lineId)
    .maybeSingle();

  if (lineError || !line) {
    throw new Error(lineError?.message ?? "Campaign line not found.");
  }

  const { data: rows, error: rowsError } = await supabase
    .from("assignment_deliverables")
    .select("revenue_before_vat, cost_before_vat, quantity")
    .eq("campaign_line_id", lineId)
    .order("sort_order");

  if (rowsError) {
    throw new Error(rowsError.message);
  }

  const deliverables = (rows ?? []) as DeliverableRollupRow[];
  if (deliverables.length === 0) {
    return;
  }

  const revenueBeforeVat = roundMoney(
    deliverables.reduce((sum, row) => sum + Number(row.revenue_before_vat), 0)
  );
  const costBeforeVat = roundMoney(
    deliverables.reduce((sum, row) => sum + Number(row.cost_before_vat), 0)
  );
  const deliverableCount = deliverables.reduce(
    (sum, row) => sum + Number(row.quantity),
    0
  );
  const gpResult = computeOperationalGp(revenueBeforeVat, costBeforeVat);

  const lineCtx = line as LineContext;
  const vatPayload = buildLineVatPayload({
    revenue_before_vat: revenueBeforeVat,
    revenue_vat_percent: Number(lineCtx.revenue_vat_percent ?? 0),
    revenue_vat_exempt: lineCtx.revenue_vat_exempt ?? false,
    cost_before_vat: costBeforeVat,
    cost_vat_percent: Number(lineCtx.cost_vat_percent ?? 0),
    cost_vat_exempt: lineCtx.cost_vat_exempt ?? false,
  });

  const metadata = { ...(lineCtx.metadata ?? {}) };
  const assignment = (metadata.influencer_assignment ?? {}) as Record<string, unknown>;
  metadata.influencer_assignment = {
    ...assignment,
    pricing_mode: "per_deliverable",
  };

  await supabase
    .from("campaign_lines")
    .update({
      ...vatPayload,
      gp: gpResult.gp,
      margin_percent: gpResult.marginPercent,
      deliverable_count: deliverableCount,
      pricing_mode: "per_deliverable",
      metadata,
    })
    .eq("id", lineId);

  await syncLineBillingFromDeliverables(
    supabase,
    lineId,
    lineCtx.billing_status
  );
}
