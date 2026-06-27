"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormActionState } from "@/features/campaigns/form-action-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addPostToDeliverable,
  createAssignmentDeliverable,
  deleteAssignmentDeliverable,
  updateAssignmentDeliverable,
  updateDeliverablePlatformType,
  updatePostSchedule,
} from "@/lib/services/campaigns/campaign-deliverable-service";

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
  usage_rights_amount: z.coerce.number().min(0).optional(),
  usage_rights_cost: z.coerce.number().min(0).optional(),
  agency_fee_percent: z.coerce.number().min(0).max(100).optional(),
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
    const result = await createAssignmentDeliverable(supabase, parsed.data);
    if (result.ok) revalidateCampaign(parsed.data.campaign_id);
    return result;
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
    const result = await updateAssignmentDeliverable(supabase, parsed.data);
    if (result.ok) revalidateCampaign(parsed.data.campaign_id);
    return result;
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
    const result = await deleteAssignmentDeliverable(supabase, parsed.data);
    if (result.ok) revalidateCampaign(parsed.data.campaign_id);
    return result;
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
    const result = await updatePostSchedule(supabase, parsed.data);
    if (result.ok) revalidateCampaign(parsed.data.campaign_id);
    return result;
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
    const result = await addPostToDeliverable(supabase, parsed.data);
    if (result.ok) revalidateCampaign(parsed.data.campaign_id);
    return result;
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
    const result = await updateDeliverablePlatformType(supabase, parsed.data);
    if (result.ok) revalidateCampaign(parsed.data.campaign_id);
    return result;
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to update platform.",
    };
  }
}

export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;
export type UpdateDeliverableInput = z.infer<typeof updateDeliverableSchema>;
