"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/permissions-server";
import { logAuditEvent } from "@/lib/audit/log-audit-event";
import {
  cancelCampaign,
  previewCampaignCancellation,
  reopenCampaign,
} from "@/lib/finance/cancellation-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CampaignStatus } from "@/types/database";

export type CampaignCancelActionState = {
  ok: boolean;
  message?: string;
  preview?: {
    allowed: boolean;
    reason?: string;
    has_vendor_ios: boolean;
    vendor_io_count: number;
    active_invoice_count: number;
    client_io_count: number;
    period_locked: boolean;
    period_label?: string;
  };
};

const cancelSchema = z.object({
  campaign_id: z.string().uuid(),
  reason: z.string().trim().optional(),
  target_status: z
    .enum(["draft", "planning", "active", "paused", "completed", "cancelled"])
    .optional(),
});

export async function previewCancelCampaignAction(
  campaignId: string
): Promise<CampaignCancelActionState> {
  try {
    const supabase = await createSupabaseServerClient();
    const preview = await previewCampaignCancellation(supabase, campaignId);
    return {
      ok: true,
      preview: {
        allowed: preview.allowed,
        reason: preview.reason,
        has_vendor_ios: preview.has_vendor_ios,
        vendor_io_count: preview.vendor_io_count,
        active_invoice_count: preview.active_invoice_count,
        client_io_count: preview.client_io_count,
        period_locked: preview.period_locked,
        period_label: preview.period_label,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Preview failed.",
    };
  }
}

export async function cancelCampaignAction(
  _prev: CampaignCancelActionState,
  formData: FormData
): Promise<CampaignCancelActionState> {
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: "Invalid campaign cancellation request." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const result = await cancelCampaign(supabase, {
    campaign_id: parsed.data.campaign_id,
    actor_id: auth.userId,
    reason: parsed.data.reason,
  });

  if (!result.ok) {
    return { ok: false, message: result.error };
  }

  void logAuditEvent(supabase, {
    userId: auth.userId,
    action: "delete",
    entityType: "campaign_header",
    entityId: parsed.data.campaign_id,
    metadata: { reason: parsed.data.reason, operation: "cancel" },
  });

  revalidatePath(`/campaigns/${parsed.data.campaign_id}`);
  revalidatePath("/campaigns");
  revalidatePath("/finance/invoices");

  return {
    ok: true,
    message: `Campaign cancelled. ${result.invoice_count} invoice(s), ${result.client_io_count} client IO(s), and ${result.vendor_io_count} vendor IO(s) marked cancelled.`,
  };
}

export async function reopenCampaignAction(
  _prev: CampaignCancelActionState,
  formData: FormData
): Promise<CampaignCancelActionState> {
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: "Invalid campaign reopen request." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const result = await reopenCampaign(supabase, {
    campaign_id: parsed.data.campaign_id,
    actor_id: auth.userId,
    target_status: (parsed.data.target_status as CampaignStatus | undefined) ?? "active",
    reason: parsed.data.reason,
  });

  if (!result.ok) {
    return { ok: false, message: result.error };
  }

  void logAuditEvent(supabase, {
    userId: auth.userId,
    action: "update",
    entityType: "campaign_header",
    entityId: parsed.data.campaign_id,
    metadata: {
      reason: parsed.data.reason,
      operation: "reopen",
      target_status: parsed.data.target_status,
    },
  });

  revalidatePath(`/campaigns/${parsed.data.campaign_id}`);
  revalidatePath("/campaigns");

  return { ok: true, message: "Campaign reopened." };
}
