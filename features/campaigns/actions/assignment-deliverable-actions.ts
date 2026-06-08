"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormActionState } from "@/features/campaigns/actions";
import {
  loadLineVatForDeliverable,
  syncDeliverableRollupFromPosts,
  syncPostSchedulesForDeliverable,
} from "@/lib/assignments/sync-post-schedules";
import { syncLineCommercialRollupsFromDeliverables } from "@/lib/assignments/sync-line-rollups";
import { applyLiveAdDateLockAfterDateInsert } from "@/lib/billing/apply-live-ad-date-lock";
import { syncAssignmentLineTitleFromDeliverables } from "@/lib/campaigns/sync-assignment-line-title";
import { canEditLiveAdDate } from "@/lib/campaigns/live-ad-date";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeVatLine } from "@/lib/vat/calculations";

const platformSchema = z.string().trim().min(1).max(64);
const deliverableTypeSchema = z.string().trim().min(1).max(64);
const billingStatusSchema = z.enum([
  "draft",
  "ready_to_invoice",
  "partially_invoiced",
  "invoiced",
  "partially_collected",
  "collected",
  "disputed",
  "cancelled",
]);

const createDeliverableSchema = z.object({
  campaign_id: z.string().uuid(),
  campaign_line_id: z.string().uuid(),
  platform: platformSchema.default("instagram"),
  deliverable_type: deliverableTypeSchema.default("instagram_reel"),
  quantity: z.coerce.number().int().min(1).max(999),
  unit_cost: z.coerce.number().min(0),
  unit_revenue: z.coerce.number().min(0),
  revenue_vat_percent: z.coerce.number().min(0).max(100).optional(),
  cost_vat_percent: z.coerce.number().min(0).max(100).optional(),
  live_date: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const updateDeliverableSchema = createDeliverableSchema.extend({
  deliverable_id: z.string().uuid(),
  billing_status: billingStatusSchema.optional(),
});

const deleteDeliverableSchema = z.object({
  campaign_id: z.string().uuid(),
  deliverable_id: z.string().uuid(),
});

const updateScheduleSchema = z.object({
  campaign_id: z.string().uuid(),
  schedule_id: z.string().uuid(),
  live_date: z.string().nullable(),
  status: z.string().trim().min(1).max(64),
  revenue_per_post: z.coerce.number().min(0).optional(),
  cost_per_post: z.coerce.number().min(0).optional(),
  revenue_vat_percent: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(2000).nullable().optional(),
  billing_status: billingStatusSchema.optional(),
  platform: platformSchema.optional(),
  deliverable_type: deliverableTypeSchema.optional(),
});

const updateDeliverablePlatformSchema = z.object({
  campaign_id: z.string().uuid(),
  campaign_line_id: z.string().uuid(),
  deliverable_id: z.string().uuid(),
  platform: platformSchema,
  deliverable_type: deliverableTypeSchema,
});

const addPostSchema = z.object({
  campaign_id: z.string().uuid(),
  deliverable_id: z.string().uuid(),
});

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function revalidateCampaign(campaignId: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
}

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return supabase;
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
  supabase: Awaited<ReturnType<typeof requireAuth>>,
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
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
  cost_vat_percent: number;
  cost_vat_exempt: boolean;
}) {
  const costBeforeVat = roundMoney(input.quantity * input.unit_cost);
  const revenueBeforeVat = roundMoney(input.quantity * input.unit_revenue);

  const revenue = computeVatLine({
    beforeVat: revenueBeforeVat,
    vatPercent: input.revenue_vat_exempt ? 0 : input.revenue_vat_percent,
    exempt: input.revenue_vat_exempt,
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
    revenue_before_vat: revenueBeforeVat,
    revenue_vat_percent: revenue.vatPercent,
    revenue_vat_amount: revenue.vatAmount,
    revenue_after_vat: revenue.afterVat,
    revenue_vat_exempt: revenue.exempt,
    billable_amount: revenueBeforeVat,
  };
}

export async function createAssignmentDeliverableAction(
  input: z.infer<typeof createDeliverableSchema>
): Promise<FormActionState> {
  const parsed = createDeliverableSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid deliverable input.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await requireAuth();
    const line = await loadLineContext(supabase, parsed.data.campaign_line_id);

    if (line.vendor_assignment_locked) {
      return { ok: false, message: "Assignment is locked and cannot be edited." };
    }

    const { count } = await supabase
      .from("assignment_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("campaign_line_id", line.id);

    const sortOrder = count ?? 0;
    const commercial = computeDeliverableCommercial({
      quantity: parsed.data.quantity,
      unit_cost: parsed.data.unit_cost,
      unit_revenue: parsed.data.unit_revenue,
      revenue_vat_percent:
        parsed.data.revenue_vat_percent ?? Number(line.revenue_vat_percent ?? 0),
      revenue_vat_exempt: line.revenue_vat_exempt ?? false,
      cost_vat_percent:
        parsed.data.cost_vat_percent ?? Number(line.cost_vat_percent ?? 0),
      cost_vat_exempt: line.cost_vat_exempt ?? false,
    });

    const { data: inserted, error } = await supabase
      .from("assignment_deliverables")
      .insert({
        campaign_header_id: line.campaign_header_id,
        campaign_line_id: line.id,
        sort_order: sortOrder,
        platform: parsed.data.platform,
        deliverable_type: parsed.data.deliverable_type,
        quantity: commercial.quantity,
        unit_cost: commercial.unit_cost,
        total_cost: commercial.total_cost,
        revenue_before_vat: commercial.revenue_before_vat,
        revenue_vat_percent: commercial.revenue_vat_percent,
        revenue_vat_amount: commercial.revenue_vat_amount,
        revenue_after_vat: commercial.revenue_after_vat,
        revenue_vat_exempt: commercial.revenue_vat_exempt,
        cost_before_vat: commercial.cost_before_vat,
        cost_vat_percent: commercial.cost_vat_percent,
        cost_vat_amount: commercial.cost_vat_amount,
        cost_after_vat: commercial.cost_after_vat,
        cost_vat_exempt: commercial.cost_vat_exempt,
        live_date: parsed.data.live_date ?? null,
        schedule_mode: commercial.quantity > 1 ? "expanded" : "single",
        notes: parsed.data.notes ?? null,
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
    revalidateCampaign(parsed.data.campaign_id);
    return { ok: true, message: "Deliverable added." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to add deliverable.",
    };
  }
}

export async function updateAssignmentDeliverableAction(
  input: z.infer<typeof updateDeliverableSchema>
): Promise<FormActionState> {
  const parsed = updateDeliverableSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid deliverable input.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await requireAuth();
    const line = await loadLineContext(supabase, parsed.data.campaign_line_id);

    const { data: existing, error: fetchError } = await supabase
      .from("assignment_deliverables")
      .select(
        "id, locked_at, invoiced_amount, billing_status, invoice_line_item_id, live_date"
      )
      .eq("id", parsed.data.deliverable_id)
      .eq("campaign_line_id", line.id)
      .maybeSingle();

    if (fetchError || !existing) {
      return { ok: false, message: fetchError?.message ?? "Deliverable not found." };
    }

    const invoicedOpenForLiveDate =
      Boolean(existing.invoice_line_item_id) ||
      ["invoiced", "partially_invoiced", "partially_paid", "paid"].includes(
        existing.billing_status ?? ""
      );

    if (
      invoicedOpenForLiveDate &&
      canEditLiveAdDate(existing.live_date, existing.locked_at)
    ) {
      const nextLiveDate = parsed.data.live_date ?? null;
      const { error: dateError } = await supabase
        .from("assignment_deliverables")
        .update({ live_date: nextLiveDate })
        .eq("id", parsed.data.deliverable_id);

      if (dateError) {
        return { ok: false, message: dateError.message };
      }

      await supabase
        .from("assignment_post_schedule")
        .update({ live_date: nextLiveDate })
        .eq("assignment_deliverable_id", parsed.data.deliverable_id);

      if (nextLiveDate) {
        const lockResult = await applyLiveAdDateLockAfterDateInsert(
          supabase,
          parsed.data.deliverable_id,
          nextLiveDate
        );
        if (lockResult.error) {
          return { ok: false, message: lockResult.error };
        }
      }

      revalidateCampaign(parsed.data.campaign_id);
      return { ok: true, message: "Live ad date saved." };
    }

    if (line.vendor_assignment_locked) {
      return { ok: false, message: "Assignment is locked and cannot be edited." };
    }

    if (existing.locked_at) {
      return { ok: false, message: "Deliverable is invoiced and locked." };
    }

    const commercial = computeDeliverableCommercial({
      quantity: parsed.data.quantity,
      unit_cost: parsed.data.unit_cost,
      unit_revenue: parsed.data.unit_revenue,
      revenue_vat_percent:
        parsed.data.revenue_vat_percent ?? Number(line.revenue_vat_percent ?? 0),
      revenue_vat_exempt: line.revenue_vat_exempt ?? false,
      cost_vat_percent:
        parsed.data.cost_vat_percent ?? Number(line.cost_vat_percent ?? 0),
      cost_vat_exempt: line.cost_vat_exempt ?? false,
    });

    const invoicedAmount = Number(existing.invoiced_amount ?? 0);
    const remainingAmount = Math.max(0, commercial.billable_amount - invoicedAmount);

    const { error } = await supabase
      .from("assignment_deliverables")
      .update({
        platform: parsed.data.platform,
        deliverable_type: parsed.data.deliverable_type,
        quantity: commercial.quantity,
        unit_cost: commercial.unit_cost,
        total_cost: commercial.total_cost,
        revenue_before_vat: commercial.revenue_before_vat,
        revenue_vat_percent: commercial.revenue_vat_percent,
        revenue_vat_amount: commercial.revenue_vat_amount,
        revenue_after_vat: commercial.revenue_after_vat,
        revenue_vat_exempt: commercial.revenue_vat_exempt,
        cost_before_vat: commercial.cost_before_vat,
        cost_vat_percent: commercial.cost_vat_percent,
        cost_vat_amount: commercial.cost_vat_amount,
        cost_after_vat: commercial.cost_after_vat,
        cost_vat_exempt: commercial.cost_vat_exempt,
        live_date: parsed.data.live_date ?? null,
        notes: parsed.data.notes ?? null,
        billable_amount: commercial.billable_amount,
        remaining_amount: remainingAmount,
        ...(parsed.data.billing_status
          ? { billing_status: parsed.data.billing_status }
          : {}),
      })
      .eq("id", parsed.data.deliverable_id);

    if (error) {
      return { ok: false, message: error.message };
    }

    const lineVat = await loadLineVatForDeliverable(supabase, line.id);
    await syncPostSchedulesForDeliverable(
      supabase,
      {
        id: parsed.data.deliverable_id,
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
        live_date: parsed.data.live_date ?? null,
        notes: parsed.data.notes ?? null,
        billing_status: parsed.data.billing_status ?? existing.billing_status,
        locked_at: existing.locked_at,
      },
      lineVat
    );

    await syncLineCommercialRollupsFromDeliverables(supabase, line.id);
    await syncAssignmentLineTitleFromDeliverables(supabase, line.id);
    revalidateCampaign(parsed.data.campaign_id);
    return { ok: true, message: "Deliverable updated." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update deliverable.",
    };
  }
}

export async function deleteAssignmentDeliverableAction(
  input: z.infer<typeof deleteDeliverableSchema>
): Promise<FormActionState> {
  const parsed = deleteDeliverableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid delete request." };
  }

  try {
    const supabase = await requireAuth();

    const { data: existing, error: fetchError } = await supabase
      .from("assignment_deliverables")
      .select("id, campaign_line_id, locked_at")
      .eq("id", parsed.data.deliverable_id)
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
      .eq("assignment_deliverable_id", parsed.data.deliverable_id);

    const { error } = await supabase
      .from("assignment_deliverables")
      .delete()
      .eq("id", parsed.data.deliverable_id);

    if (error) {
      return { ok: false, message: error.message };
    }

    await syncLineCommercialRollupsFromDeliverables(supabase, existing.campaign_line_id);
    revalidateCampaign(parsed.data.campaign_id);
    return { ok: true, message: "Deliverable removed." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to delete deliverable.",
    };
  }
}

export async function updatePostScheduleAction(
  input: z.infer<typeof updateScheduleSchema>
): Promise<FormActionState> {
  const parsed = updateScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid schedule input." };
  }

  try {
    const supabase = await requireAuth();

    const { data: post, error: fetchError } = await supabase
      .from("assignment_post_schedule")
      .select(
        "id, assignment_deliverable_id, campaign_line_id, revenue_before_vat, cost_before_vat, metadata, live_date, locked_at"
      )
      .eq("id", parsed.data.schedule_id)
      .maybeSingle();

    if (fetchError || !post) {
      return { ok: false, message: fetchError?.message ?? "Post not found." };
    }

    if (post.locked_at) {
      return { ok: false, message: "Post is locked after live ad date was set." };
    }

    const { data: deliverable, error: deliverableError } = await supabase
      .from("assignment_deliverables")
      .select("id, locked_at, invoice_line_item_id, live_date, billing_status")
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
      const nextLiveDate = parsed.data.live_date;
      const { error: dateError } = await supabase
        .from("assignment_post_schedule")
        .update({ live_date: nextLiveDate })
        .eq("id", parsed.data.schedule_id);

      if (dateError) {
        return { ok: false, message: dateError.message };
      }

      await supabase
        .from("assignment_deliverables")
        .update({ live_date: nextLiveDate })
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

      revalidateCampaign(parsed.data.campaign_id);
      return { ok: true, message: "Live ad date saved." };
    }

    const line = await loadLineContext(supabase, post.campaign_line_id);
    if (line.vendor_assignment_locked) {
      return { ok: false, message: "Assignment is locked and cannot be edited." };
    }

    const lineVat = await loadLineVatForDeliverable(supabase, post.campaign_line_id);

    const revenuePerPost =
      parsed.data.revenue_per_post ?? Number(post.revenue_before_vat ?? 0);
    const costPerPost = parsed.data.cost_per_post ?? Number(post.cost_before_vat ?? 0);
    const revenueVatPercent =
      parsed.data.revenue_vat_percent ?? lineVat.revenue_vat_percent;

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

    const metadata = {
      ...((post.metadata as Record<string, unknown>) ?? {}),
      ...(parsed.data.platform ? { platform: parsed.data.platform } : {}),
      ...(parsed.data.deliverable_type
        ? { deliverable_type: parsed.data.deliverable_type }
        : {}),
    };

    const { error } = await supabase
      .from("assignment_post_schedule")
      .update({
        live_date: parsed.data.live_date,
        status: parsed.data.status,
        notes: parsed.data.notes ?? undefined,
        revenue_before_vat: revenue.beforeVat,
        cost_before_vat: cost.beforeVat,
        revenue_vat_percent: revenue.vatPercent,
        revenue_vat_amount: revenue.vatAmount,
        cost_vat_percent: cost.vatPercent,
        cost_vat_amount: cost.vatAmount,
        metadata,
        ...(parsed.data.billing_status
          ? { billing_status: parsed.data.billing_status }
          : {}),
      })
      .eq("id", parsed.data.schedule_id);

    if (error) {
      return { ok: false, message: error.message };
    }

    await syncDeliverableRollupFromPosts(
      supabase,
      post.assignment_deliverable_id,
      lineVat
    );
    await syncAssignmentLineTitleFromDeliverables(supabase, post.campaign_line_id);
    revalidateCampaign(parsed.data.campaign_id);
    return { ok: true, message: "Post updated." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update post.",
    };
  }
}

export async function addPostToDeliverableAction(
  input: z.infer<typeof addPostSchema>
): Promise<FormActionState> {
  const parsed = addPostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid add post request." };
  }

  try {
    const supabase = await requireAuth();

    const { data: deliverable, error } = await supabase
      .from("assignment_deliverables")
      .select(
        "id, campaign_line_id, quantity, unit_cost, revenue_before_vat, cost_before_vat, revenue_vat_percent, revenue_vat_amount, cost_vat_percent, cost_vat_amount, live_date, notes, billing_status, locked_at"
      )
      .eq("id", parsed.data.deliverable_id)
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

    revalidateCampaign(parsed.data.campaign_id);
    return { ok: true, message: "Post added." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to add post.",
    };
  }
}

export async function updateDeliverablePlatformTypeAction(
  input: z.infer<typeof updateDeliverablePlatformSchema>
): Promise<FormActionState> {
  const parsed = updateDeliverablePlatformSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid platform or deliverable type." };
  }

  try {
    const supabase = await requireAuth();
    const line = await loadLineContext(supabase, parsed.data.campaign_line_id);

    if (line.vendor_assignment_locked) {
      return { ok: false, message: "Assignment is locked." };
    }

    const { data: existing, error: fetchError } = await supabase
      .from("assignment_deliverables")
      .select("id, locked_at")
      .eq("id", parsed.data.deliverable_id)
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
        platform: parsed.data.platform,
        deliverable_type: parsed.data.deliverable_type,
      })
      .eq("id", parsed.data.deliverable_id);

    if (error) {
      return { ok: false, message: error.message };
    }

    await syncAssignmentLineTitleFromDeliverables(supabase, line.id);
    revalidateCampaign(parsed.data.campaign_id);
    return { ok: true, message: "Platform updated." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to update platform.",
    };
  }
}

export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;
export type UpdateDeliverableInput = z.infer<typeof updateDeliverableSchema>;
