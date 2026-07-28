"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  detectLegacyCampaignForBackfill,
  executeBackfillAssignmentsFromQuotation,
  previewBackfillAssignmentsFromQuotation,
} from "@/lib/services/campaigns/backfill-assignments-from-quotation";
import { isRelease20AssignmentConvertEnabled } from "@/lib/release/release-2-0-feature-flag";

type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string };

async function getCampaignActor(): Promise<
  | { ok: true; supabase: SupabaseClient<Database>; userId: string }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as SupabaseClient<Database>;
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) return { ok: false, message: auth.error };
  return { ok: true, supabase, userId: auth.userId };
}

export async function detectCampaignBackfillEligibility(campaignId: string) {
  const actor = await getCampaignActor();
  if (!actor.ok) return actor;

  if (!isRelease20AssignmentConvertEnabled()) {
    return {
      ok: true as const,
      data: {
        eligible: false,
        campaignId,
        documentNumber: "",
        quotationId: null,
        quotationSerial: null,
        quotationStatus: null,
        lineCount: 0,
        vendorLinkCount: 0,
        vendorIoCount: 0,
        invoiceLinkCount: 0,
        reason: "Release 2.0 Assignment convert is not enabled.",
        warnings: [] as string[],
      },
    };
  }

  const data = await detectLegacyCampaignForBackfill(actor.supabase, campaignId);
  return { ok: true as const, data };
}

export async function previewCampaignAssignmentBackfill(
  campaignId: string
): Promise<ActionResult<Record<string, unknown>>> {
  const actor = await getCampaignActor();
  if (!actor.ok) return actor;

  if (!isRelease20AssignmentConvertEnabled()) {
    return { ok: false, message: "Release 2.0 Assignment convert is not enabled." };
  }

  const result = await previewBackfillAssignmentsFromQuotation(
    actor.supabase,
    actor.userId,
    campaignId
  );
  if (!result.ok) return { ok: false, message: result.message };

  return {
    ok: true,
    data: result as unknown as Record<string, unknown>,
    message: result.message,
  };
}

export async function executeCampaignAssignmentBackfill(
  campaignId: string
): Promise<
  ActionResult<{
    campaignId: string;
    documentNumber: string;
    linesCreated: number;
    warnings: string[];
    snapshotHash?: string;
  }>
> {
  const actor = await getCampaignActor();
  if (!actor.ok) return actor;

  if (!isRelease20AssignmentConvertEnabled()) {
    return { ok: false, message: "Release 2.0 Assignment convert is not enabled." };
  }

  const result = await executeBackfillAssignmentsFromQuotation(
    actor.supabase,
    actor.userId,
    campaignId
  );
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(`/campaigns/${campaignId}`);

  return {
    ok: true,
    data: {
      campaignId: result.campaignId,
      documentNumber: result.documentNumber,
      linesCreated: result.linesCreated,
      warnings: result.warnings,
      snapshotHash: result.snapshotHash,
    },
    message: result.message,
  };
}
