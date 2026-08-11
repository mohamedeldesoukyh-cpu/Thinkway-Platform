import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadLineVatForDeliverable,
  syncDeliverableRollupFromPosts,
  syncPostSchedulesForDeliverable,
} from "@/lib/assignments/sync-post-schedules";
import { syncLineCommercialRollupsFromDeliverables } from "@/lib/assignments/sync-line-rollups";
import {
  loadLineCommercialGateSnapshot,
  markIssuedIoRevisionAfterAssignmentCommercialChange,
} from "@/lib/assignments/mark-issued-io-revision-after-commercial-change";
import { applyLiveAdDateLockAfterDateInsert } from "@/lib/billing/apply-live-ad-date-lock";
import { syncAssignmentLineTitleFromDeliverables } from "@/lib/campaigns/sync-assignment-line-title";
import { canEditLiveAdDate } from "@/lib/campaigns/live-ad-date";
import { withManualLiveDateSource } from "@/lib/campaigns/sync-live-date-from-publication";
import { computeClientBilling } from "@/lib/assignments/client-billing-commercial";
import { computeVatLine } from "@/lib/vat/calculations";

export type ServiceResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export type CreateAssignmentDeliverableInput = {
  campaign_id: string;
  campaign_line_id: string;
  platform: string;
  deliverable_type: string;
  quantity: number;
  unit_cost: number;
  unit_revenue: number;
  revenue_vat_percent?: number;
  cost_vat_percent?: number;
  live_date?: string | null;
  notes?: string | null;
  usage_rights_amount?: number;
  usage_rights_cost?: number;
  agency_fee_percent?: number;
};

export type UpdateAssignmentDeliverableInput = CreateAssignmentDeliverableInput & {
  deliverable_id: string;
  billing_status?: string;
};

export type DeleteAssignmentDeliverableInput = {
  campaign_id: string;
  deliverable_id: string;
};

export type UpdatePostScheduleInput = {
  campaign_id: string;
  schedule_id: string;
  live_date: string | null;
  status: string;
  revenue_per_post?: number;
  cost_per_post?: number;
  revenue_vat_percent?: number;
  notes?: string | null;
  billing_status?: string;
  platform?: string;
  deliverable_type?: string;
};

export type AddPostToDeliverableInput = {
  campaign_id: string;
  deliverable_id: string;
};

export type UpdateDeliverablePlatformTypeInput = {
  campaign_id: string;
  campaign_line_id: string;
  deliverable_id: string;
  platform: string;
  deliverable_type: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type LineVatContext = {
  id: string;
  campaign_header_id: string;
  billing_status: string;
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
  cost_vat_percent: number;
  cost_vat_exempt: boolean;
  vendor_assignment_locked: boolean;
};

async function loadLineContext(
  supabase: SupabaseClient,
  lineId: string
): Promise<LineVatContext> {
  const { data, error } = await supabase
    .from("campaign_lines")
    .select(
      "id, campaign_header_id, billing_status, revenue_vat_percent, revenue_vat_exempt, cost_vat_percent, cost_vat_exempt, vendor_assignment_locked"
    )
    .eq("id", lineId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Campaign line not found.");
  }

  return data as LineVatContext;
}

function computeDeliverableCommercial(input: {
  quantity: number;
  unit_cost: number;
  unit_revenue: number;
  usage_rights_amount?: number;
  usage_rights_cost?: number;
  agency_fee_percent?: number;
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
  cost_vat_percent: number;
  cost_vat_exempt: boolean;
}) {
  const costBeforeVat = roundMoney(input.quantity * input.unit_cost);
  const revenueBeforeVat = roundMoney(input.quantity * input.unit_revenue);

  const billing = computeClientBilling({
    revenueBeforeVat,
    usageRightsAmount: input.usage_rights_amount,
    usageRightsCost: input.usage_rights_cost,
    agencyFeePercent: input.agency_fee_percent,
    vatPercent: input.revenue_vat_exempt ? 0 : input.revenue_vat_percent,
    vatExempt: input.revenue_vat_exempt,
    costBeforeVat,
  });

  const cost = computeVatLine({
    beforeVat: costBeforeVat,
    vatPercent: input.cost_vat_exempt ? 0 : input.cost_vat_percent,
    exempt: input.cost_vat_exempt,
  });

  return {
    quantity: input.quantity,
    unit_cost: input.unit_cost,
    total_cost: costBeforeVat,
    cost_before_vat: costBeforeVat,
    cost_vat_percent: cost.vatPercent,
    cost_vat_amount: cost.vatAmount,
    cost_after_vat: cost.afterVat,
    cost_vat_exempt: cost.exempt,
    revenue_before_vat: billing.revenueBeforeVat,
    usage_rights_amount: billing.usageRightsAmount,
    usage_rights_cost: billing.usageRightsCost,
    agency_fee_percent: billing.agencyFeePercent,
    agency_fee_amount: billing.agencyFeeAmount,
    revenue_vat_percent: billing.vatPercent,
    revenue_vat_amount: billing.vatAmount,
    revenue_after_vat: billing.totalBilling,
    revenue_vat_exempt: input.revenue_vat_exempt,
    billable_amount: billing.taxableBase,
  };
}

export async function createAssignmentDeliverable(
  supabase: SupabaseClient,
  input: CreateAssignmentDeliverableInput
): Promise<ServiceResult> {
  try {
    const line = await loadLineContext(supabase, input.campaign_line_id);

    if (line.vendor_assignment_locked) {
      return { ok: false, message: "Assignment is locked and cannot be edited." };
    }

    const { count } = await supabase
      .from("assignment_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("campaign_line_id", line.id);

    const sortOrder = count ?? 0;
    const commercial = computeDeliverableCommercial({
      quantity: input.quantity,
      unit_cost: input.unit_cost,
      unit_revenue: input.unit_revenue,
      usage_rights_amount: input.usage_rights_amount,
      usage_rights_cost: input.usage_rights_cost,
      agency_fee_percent: input.agency_fee_percent,
      revenue_vat_percent:
        input.revenue_vat_percent ?? Number(line.revenue_vat_percent ?? 0),
      revenue_vat_exempt: line.revenue_vat_exempt ?? false,
      cost_vat_percent:
        input.cost_vat_percent ?? Number(line.cost_vat_percent ?? 0),
      cost_vat_exempt: line.cost_vat_exempt ?? false,
    });

    const { data: inserted, error } = await supabase
      .from("assignment_deliverables")
      .insert({
        campaign_header_id: line.campaign_header_id,
        campaign_line_id: line.id,
        sort_order: sortOrder,
        platform: input.platform,
        deliverable_type: input.deliverable_type,
        quantity: commercial.quantity,
        unit_cost: commercial.unit_cost,
        total_cost: commercial.total_cost,
        revenue_before_vat: commercial.revenue_before_vat,
        usage_rights_amount: commercial.usage_rights_amount,
        usage_rights_cost: commercial.usage_rights_cost,
        agency_fee_percent: commercial.agency_fee_percent,
        agency_fee_amount: commercial.agency_fee_amount,
        revenue_vat_percent: commercial.revenue_vat_percent,
        revenue_vat_amount: commercial.revenue_vat_amount,
        revenue_after_vat: commercial.revenue_after_vat,
        revenue_vat_exempt: commercial.revenue_vat_exempt,
        cost_before_vat: commercial.cost_before_vat,
        cost_vat_percent: commercial.cost_vat_percent,
        cost_vat_amount: commercial.cost_vat_amount,
        cost_after_vat: commercial.cost_after_vat,
        cost_vat_exempt: commercial.cost_vat_exempt,
        live_date: input.live_date ?? null,
        schedule_mode: commercial.quantity > 1 ? "expanded" : "single",
        notes: input.notes ?? null,
        billable_amount: commercial.billable_amount,
        remaining_amount: commercial.billable_amount,
        billing_status: "draft",
        metadata: {},
      })
      .select("id, quantity, unit_cost, revenue_before_vat, cost_before_vat, revenue_vat_percent, revenue_vat_amount, cost_vat_percent, cost_vat_amount, live_date, notes, billing_status, locked_at")
      .single();

    if (error || !inserted) {
      return { ok: false, message: error?.message ?? "Failed to add deliverable." };
    }

    const lineVat = await loadLineVatForDeliverable(supabase, line.id);
    await syncPostSchedulesForDeliverable(
      supabase,
      {
        id: inserted.id,
        campaign_line_id: line.id,
        quantity: inserted.quantity,
        unit_cost: Number(inserted.unit_cost),
        revenue_before_vat: Number(inserted.revenue_before_vat),
        cost_before_vat: Number(inserted.cost_before_vat),
        revenue_vat_percent: Number(inserted.revenue_vat_percent),
        revenue_vat_amount: Number(inserted.revenue_vat_amount),
        cost_vat_percent: Number(inserted.cost_vat_percent),
        cost_vat_amount: Number(inserted.cost_vat_amount),
        revenue_vat_exempt: line.revenue_vat_exempt,
        cost_vat_exempt: line.cost_vat_exempt,
        live_date: inserted.live_date,
        notes: inserted.notes,
        billing_status: inserted.billing_status,
        locked_at: inserted.locked_at,
      },
      lineVat
    );

    await syncLineCommercialRollupsFromDeliverables(supabase, line.id);
    await syncAssignmentLineTitleFromDeliverables(supabase, line.id);
    return { ok: true, message: "Deliverable added." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to add deliverable.",
    };
  }
}

export async function updateAssignmentDeliverable(
  supabase: SupabaseClient,
  input: UpdateAssignmentDeliverableInput
): Promise<ServiceResult> {
  try {
    const line = await loadLineContext(supabase, input.campaign_line_id);

    const { data: existing, error: fetchError } = await supabase
      .from("assignment_deliverables")
      .select(
        "id, locked_at, invoiced_amount, billing_status, invoice_line_item_id, live_date, metadata, usage_rights_amount, usage_rights_cost, agency_fee_percent"
      )
      .eq("id", input.deliverable_id)
      .eq("campaign_line_id", line.id)
      .maybeSingle();

    if (fetchError || !existing) {
      return { ok: false, message: fetchError?.message ?? "Deliverable not found." };
    }

    const existingCommercial = existing as {
      usage_rights_amount?: number | null;
      usage_rights_cost?: number | null;
      agency_fee_percent?: number | null;
    };

    const invoicedOpenForLiveDate =
      Boolean(existing.invoice_line_item_id) ||
      ["invoiced", "partially_invoiced", "partially_paid", "paid"].includes(
        existing.billing_status ?? ""
      );

    if (
      invoicedOpenForLiveDate &&
      canEditLiveAdDate(existing.live_date, existing.locked_at)
    ) {
      const nextLiveDate = input.live_date ?? null;
      const nextMeta = withManualLiveDateSource(
        (existing.metadata as Record<string, unknown> | null) ?? null
      );
      const { error: dateError } = await supabase
        .from("assignment_deliverables")
        .update({
          live_date: nextLiveDate,
          metadata: nextMeta as never,
        })
        .eq("id", input.deliverable_id);

      if (dateError) {
        return { ok: false, message: dateError.message };
      }

      const { data: scheduleRows } = await supabase
        .from("assignment_post_schedule")
        .select("id, metadata")
        .eq("assignment_deliverable_id", input.deliverable_id);

      for (const schedule of scheduleRows ?? []) {
        await supabase
          .from("assignment_post_schedule")
          .update({
            live_date: nextLiveDate,
            metadata: withManualLiveDateSource(
              (schedule.metadata as Record<string, unknown> | null) ?? null
            ) as never,
          })
          .eq("id", schedule.id);
      }

      if (nextLiveDate) {
        const lockResult = await applyLiveAdDateLockAfterDateInsert(
          supabase,
          input.deliverable_id,
          nextLiveDate
        );
        if (lockResult.error) {
          return { ok: false, message: lockResult.error };
        }
      }

      return { ok: true, message: "Live ad date saved." };
    }

    if (line.vendor_assignment_locked) {
      return { ok: false, message: "Assignment is locked and cannot be edited." };
    }

    if (existing.locked_at) {
      return { ok: false, message: "Deliverable is invoiced and locked." };
    }

    const beforeCommercial = await loadLineCommercialGateSnapshot(supabase, line.id);

    // Preserve AF% / UR when hierarchy Rev/Cost edits omit them so AF amount
    // recalculates from the existing fee percentage of the new client amount.
    const commercial = computeDeliverableCommercial({
      quantity: input.quantity,
      unit_cost: input.unit_cost,
      unit_revenue: input.unit_revenue,
      usage_rights_amount:
        input.usage_rights_amount ?? Number(existingCommercial.usage_rights_amount ?? 0),
      usage_rights_cost:
        input.usage_rights_cost ?? Number(existingCommercial.usage_rights_cost ?? 0),
      agency_fee_percent:
        input.agency_fee_percent ?? Number(existingCommercial.agency_fee_percent ?? 0),
      revenue_vat_percent:
        input.revenue_vat_percent ?? Number(line.revenue_vat_percent ?? 0),
      revenue_vat_exempt: line.revenue_vat_exempt ?? false,
      cost_vat_percent:
        input.cost_vat_percent ?? Number(line.cost_vat_percent ?? 0),
      cost_vat_exempt: line.cost_vat_exempt ?? false,
    });

    const invoicedAmount = Number(existing.invoiced_amount ?? 0);
    const remainingAmount = Math.max(0, commercial.billable_amount - invoicedAmount);
    const nextLiveDate = input.live_date ?? null;
    const existingMeta =
      (existing.metadata as Record<string, unknown> | null) ?? null;
    const nextMeta =
      nextLiveDate !== (existing.live_date ?? null)
        ? withManualLiveDateSource(existingMeta)
        : existingMeta;

    const { error } = await supabase
      .from("assignment_deliverables")
      .update({
        platform: input.platform,
        deliverable_type: input.deliverable_type,
        quantity: commercial.quantity,
        unit_cost: commercial.unit_cost,
        total_cost: commercial.total_cost,
        revenue_before_vat: commercial.revenue_before_vat,
        usage_rights_amount: commercial.usage_rights_amount,
        usage_rights_cost: commercial.usage_rights_cost,
        agency_fee_percent: commercial.agency_fee_percent,
        agency_fee_amount: commercial.agency_fee_amount,
        revenue_vat_percent: commercial.revenue_vat_percent,
        revenue_vat_amount: commercial.revenue_vat_amount,
        revenue_after_vat: commercial.revenue_after_vat,
        revenue_vat_exempt: commercial.revenue_vat_exempt,
        cost_before_vat: commercial.cost_before_vat,
        cost_vat_percent: commercial.cost_vat_percent,
        cost_vat_amount: commercial.cost_vat_amount,
        cost_after_vat: commercial.cost_after_vat,
        cost_vat_exempt: commercial.cost_vat_exempt,
        live_date: nextLiveDate,
        notes: input.notes ?? null,
        billable_amount: commercial.billable_amount,
        remaining_amount: remainingAmount,
        ...(nextMeta ? { metadata: nextMeta as never } : {}),
        ...(input.billing_status
          ? { billing_status: input.billing_status }
          : {}),
      })
      .eq("id", input.deliverable_id);

    if (error) {
      return { ok: false, message: error.message };
    }

    const lineVat = await loadLineVatForDeliverable(supabase, line.id);
    await syncPostSchedulesForDeliverable(
      supabase,
      {
        id: input.deliverable_id,
        campaign_line_id: line.id,
        quantity: commercial.quantity,
        unit_cost: commercial.unit_cost,
        revenue_before_vat: commercial.revenue_before_vat,
        cost_before_vat: commercial.cost_before_vat,
        revenue_vat_percent: commercial.revenue_vat_percent,
        revenue_vat_amount: commercial.revenue_vat_amount,
        cost_vat_percent: commercial.cost_vat_percent,
        cost_vat_amount: commercial.cost_vat_amount,
        revenue_vat_exempt: line.revenue_vat_exempt,
        cost_vat_exempt: line.cost_vat_exempt,
        live_date: input.live_date ?? null,
        notes: input.notes ?? null,
        billing_status: input.billing_status ?? existing.billing_status,
        locked_at: existing.locked_at,
      },
      lineVat
    );

    await syncLineCommercialRollupsFromDeliverables(supabase, line.id);
    await syncAssignmentLineTitleFromDeliverables(supabase, line.id);

    if (beforeCommercial) {
      const revision = await markIssuedIoRevisionAfterAssignmentCommercialChange(
        supabase,
        { lineId: line.id, before: beforeCommercial }
      );
      if (revision.marked) {
        return {
          ok: true,
          message:
            "Deliverable updated. Issued Client/Vendor IO marked Revision Required — regenerate and resend for commercial re-approval.",
        };
      }
    }

    return { ok: true, message: "Deliverable updated." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update deliverable.",
    };
  }
}

export async function deleteAssignmentDeliverable(
  supabase: SupabaseClient,
  input: DeleteAssignmentDeliverableInput
): Promise<ServiceResult> {
  try {

    const { data: existing, error: fetchError } = await supabase
      .from("assignment_deliverables")
      .select("id, campaign_line_id, locked_at")
      .eq("id", input.deliverable_id)
      .maybeSingle();

    if (fetchError || !existing) {
      return { ok: false, message: fetchError?.message ?? "Deliverable not found." };
    }

    if (existing.locked_at) {
      return { ok: false, message: "Deliverable is invoiced and cannot be deleted." };
    }

    const line = await loadLineContext(supabase, existing.campaign_line_id);
    if (line.vendor_assignment_locked) {
      return { ok: false, message: "Assignment is locked and cannot be edited." };
    }

    await supabase
      .from("assignment_post_schedule")
      .delete()
      .eq("assignment_deliverable_id", input.deliverable_id);

    const { error } = await supabase
      .from("assignment_deliverables")
      .delete()
      .eq("id", input.deliverable_id);

    if (error) {
      return { ok: false, message: error.message };
    }

    await syncLineCommercialRollupsFromDeliverables(supabase, existing.campaign_line_id);
    return { ok: true, message: "Deliverable removed." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to delete deliverable.",
    };
  }
}

export async function updatePostSchedule(
  supabase: SupabaseClient,
  input: UpdatePostScheduleInput
): Promise<ServiceResult> {
  try {

    const { data: post, error: fetchError } = await supabase
      .from("assignment_post_schedule")
      .select(
        "id, assignment_deliverable_id, campaign_line_id, revenue_before_vat, cost_before_vat, metadata, live_date, locked_at"
      )
      .eq("id", input.schedule_id)
      .maybeSingle();

    if (fetchError || !post) {
      return { ok: false, message: fetchError?.message ?? "Post not found." };
    }

    if (post.locked_at) {
      // STAB-027: live-ad / invoice lock freezes commercial fields and dates.
      // Workflow status (draft → posted) must still advance for timeline/ops.
      const { error: statusError } = await supabase
        .from("assignment_post_schedule")
        .update({
          status: input.status,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        })
        .eq("id", input.schedule_id);
      if (statusError) {
        return { ok: false, message: statusError.message };
      }
      return { ok: true, message: "Workflow status updated." };
    }

    const { data: deliverable, error: deliverableError } = await supabase
      .from("assignment_deliverables")
      .select("id, locked_at, invoice_line_item_id, live_date, billing_status, metadata")
      .eq("id", post.assignment_deliverable_id)
      .maybeSingle();

    if (deliverableError || !deliverable) {
      return {
        ok: false,
        message: deliverableError?.message ?? "Deliverable not found.",
      };
    }

    const invoicedOpenForLiveDate =
      Boolean(deliverable.invoice_line_item_id) ||
      ["invoiced", "partially_invoiced", "partially_paid", "paid"].includes(
        deliverable.billing_status ?? ""
      );

    if (
      invoicedOpenForLiveDate &&
      canEditLiveAdDate(post.live_date ?? deliverable.live_date, deliverable.locked_at)
    ) {
      const nextLiveDate = input.live_date;
      const nextPostMeta = withManualLiveDateSource(
        (post.metadata as Record<string, unknown> | null) ?? null
      );
      const { error: dateError } = await supabase
        .from("assignment_post_schedule")
        .update({
          live_date: nextLiveDate,
          metadata: nextPostMeta as never,
        })
        .eq("id", input.schedule_id);

      if (dateError) {
        return { ok: false, message: dateError.message };
      }

      await supabase
        .from("assignment_deliverables")
        .update({
          live_date: nextLiveDate,
          metadata: withManualLiveDateSource(
            (deliverable.metadata as Record<string, unknown> | null) ?? null
          ) as never,
        })
        .eq("id", deliverable.id);

      if (nextLiveDate) {
        const lockResult = await applyLiveAdDateLockAfterDateInsert(
          supabase,
          deliverable.id,
          nextLiveDate
        );
        if (lockResult.error) {
          return { ok: false, message: lockResult.error };
        }
      }

      return { ok: true, message: "Live ad date saved." };
    }

    const line = await loadLineContext(supabase, post.campaign_line_id);
    if (line.vendor_assignment_locked) {
      return { ok: false, message: "Assignment is locked and cannot be edited." };
    }

    const beforeCommercial = await loadLineCommercialGateSnapshot(
      supabase,
      post.campaign_line_id
    );

    const lineVat = await loadLineVatForDeliverable(supabase, post.campaign_line_id);

    const revenuePerPost =
      input.revenue_per_post ?? Number(post.revenue_before_vat ?? 0);
    const costPerPost = input.cost_per_post ?? Number(post.cost_before_vat ?? 0);
    const revenueVatPercent =
      input.revenue_vat_percent ?? lineVat.revenue_vat_percent;

    const revenue = computeVatLine({
      beforeVat: revenuePerPost,
      vatPercent: lineVat.revenue_vat_exempt ? 0 : revenueVatPercent,
      exempt: lineVat.revenue_vat_exempt,
    });
    const cost = computeVatLine({
      beforeVat: costPerPost,
      vatPercent: lineVat.cost_vat_exempt ? 0 : lineVat.cost_vat_percent,
      exempt: lineVat.cost_vat_exempt,
    });

    const metadataBase = {
      ...((post.metadata as Record<string, unknown>) ?? {}),
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.deliverable_type
        ? { deliverable_type: input.deliverable_type }
        : {}),
    };
    const nextLiveDate = input.live_date ?? null;
    const metadata =
      nextLiveDate !== (post.live_date ?? null)
        ? withManualLiveDateSource(metadataBase)
        : metadataBase;

    const { error } = await supabase
      .from("assignment_post_schedule")
      .update({
        live_date: input.live_date,
        status: input.status,
        notes: input.notes ?? undefined,
        revenue_before_vat: revenue.beforeVat,
        cost_before_vat: cost.beforeVat,
        revenue_vat_percent: revenue.vatPercent,
        revenue_vat_amount: revenue.vatAmount,
        cost_vat_percent: cost.vatPercent,
        cost_vat_amount: cost.vatAmount,
        metadata,
        ...(input.billing_status
          ? { billing_status: input.billing_status }
          : {}),
      })
      .eq("id", input.schedule_id);

    if (error) {
      return { ok: false, message: error.message };
    }

    await syncDeliverableRollupFromPosts(
      supabase,
      post.assignment_deliverable_id,
      lineVat
    );
    await syncAssignmentLineTitleFromDeliverables(supabase, post.campaign_line_id);

    if (beforeCommercial) {
      const revision = await markIssuedIoRevisionAfterAssignmentCommercialChange(
        supabase,
        { lineId: post.campaign_line_id, before: beforeCommercial }
      );
      if (revision.marked) {
        return {
          ok: true,
          message:
            "Post updated. Issued Client/Vendor IO marked Revision Required — regenerate and resend for commercial re-approval.",
        };
      }
    }

    return { ok: true, message: "Post updated." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update post.",
    };
  }
}

export async function addPostToDeliverable(
  supabase: SupabaseClient,
  input: AddPostToDeliverableInput
): Promise<ServiceResult> {
  try {

    const { data: deliverable, error } = await supabase
      .from("assignment_deliverables")
      .select(
        "id, campaign_line_id, quantity, unit_cost, revenue_before_vat, cost_before_vat, revenue_vat_percent, revenue_vat_amount, cost_vat_percent, cost_vat_amount, live_date, notes, billing_status, locked_at"
      )
      .eq("id", input.deliverable_id)
      .maybeSingle();

    if (error || !deliverable) {
      return { ok: false, message: error?.message ?? "Deliverable not found." };
    }

    if (deliverable.locked_at) {
      return { ok: false, message: "Deliverable is locked." };
    }

    const lineVat = await loadLineVatForDeliverable(supabase, deliverable.campaign_line_id);
    const nextQty = deliverable.quantity + 1;
    const unitRevenue =
      deliverable.quantity > 0
        ? Number(deliverable.revenue_before_vat) / deliverable.quantity
        : 0;
    const unitCost = Number(deliverable.unit_cost ?? 0);

    await supabase
      .from("assignment_deliverables")
      .update({ quantity: nextQty })
      .eq("id", deliverable.id);

    await syncPostSchedulesForDeliverable(
      supabase,
      {
        id: deliverable.id,
        campaign_line_id: deliverable.campaign_line_id,
        quantity: nextQty,
        unit_cost: unitCost,
        revenue_before_vat: unitRevenue * nextQty,
        cost_before_vat: unitCost * nextQty,
        revenue_vat_percent: Number(deliverable.revenue_vat_percent),
        revenue_vat_amount: Number(deliverable.revenue_vat_amount),
        cost_vat_percent: Number(deliverable.cost_vat_percent),
        cost_vat_amount: Number(deliverable.cost_vat_amount),
        revenue_vat_exempt: lineVat.revenue_vat_exempt,
        cost_vat_exempt: lineVat.cost_vat_exempt,
        live_date: deliverable.live_date,
        notes: deliverable.notes,
        billing_status: deliverable.billing_status,
        locked_at: deliverable.locked_at,
      },
      lineVat
    );

    return { ok: true, message: "Post added." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to add post.",
    };
  }
}

export async function updateDeliverablePlatformType(
  supabase: SupabaseClient,
  input: UpdateDeliverablePlatformTypeInput
): Promise<ServiceResult> {
  try {
    const line = await loadLineContext(supabase, input.campaign_line_id);

    if (line.vendor_assignment_locked) {
      return { ok: false, message: "Assignment is locked." };
    }

    const { data: existing, error: fetchError } = await supabase
      .from("assignment_deliverables")
      .select("id, locked_at")
      .eq("id", input.deliverable_id)
      .eq("campaign_line_id", line.id)
      .maybeSingle();

    if (fetchError || !existing) {
      return { ok: false, message: fetchError?.message ?? "Deliverable not found." };
    }

    if (existing.locked_at) {
      return { ok: false, message: "Deliverable is locked." };
    }

    const { error } = await supabase
      .from("assignment_deliverables")
      .update({
        platform: input.platform,
        deliverable_type: input.deliverable_type,
      })
      .eq("id", input.deliverable_id);

    if (error) {
      return { ok: false, message: error.message };
    }

    await syncAssignmentLineTitleFromDeliverables(supabase, line.id);
    return { ok: true, message: "Platform updated." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to update platform.",
    };
  }
}

