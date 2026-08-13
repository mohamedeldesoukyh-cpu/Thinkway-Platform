"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyAssignmentCommercialToCommercialRows } from "@/lib/assignments/commercial-calculations";
import { packagePlatformsToCommercialRows } from "@/lib/assignments/sync-package-deliverables";
import { parseLineAssignment } from "@/lib/campaigns/line-assignment";
import {
  updateCampaignLine,
  type UpdateCampaignLineInput,
} from "@/lib/services/campaigns/campaign-line-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const linePatchSchema = z.object({
  lineId: z.string().uuid(),
  revenue_before_vat: z.number().min(0),
  cost_before_vat: z.number().min(0),
  usage_rights_amount: z.number().min(0),
  usage_rights_cost: z.number().min(0),
  agency_fee_percent: z.number().min(0).max(100),
});

const inputSchema = z.object({
  campaignId: z.string().uuid(),
  lines: z.array(linePatchSchema).min(1),
});

export type AssignmentCommercialPatchLine = z.infer<typeof linePatchSchema>;

export type UpdateAssignmentLineCommercialsResult =
  | { ok: true; updated: number; message: string }
  | { ok: false; message: string };

type AssignmentLineRow = {
  id: string;
  name: string | null;
  platform: string | null;
  po_amount: number | null;
  currency_code: string | null;
  start_date: string | null;
  end_date: string | null;
  assignment_status: string | null;
  metadata: Record<string, unknown> | null;
  revenue_vat_percent: number | null;
  cost_vat_percent: number | null;
  revenue_vat_exempt: boolean | null;
  cost_vat_exempt: boolean | null;
  document_number: string | null;
  title_user_edited?: boolean | null;
  fx_rate?: number | null;
  cost_received?: number | null;
  cost_received_currency?: string | null;
  revenue_locked?: boolean | null;
  cost_locked?: boolean | null;
};

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user, error: null };
}

async function resolveLineInfluencerId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  lineId: string,
  campaignId: string,
  metadata: Record<string, unknown> | null
): Promise<string | null> {
  const fromMeta = parseLineAssignment(metadata)?.influencer_id ?? null;
  if (fromMeta) return fromMeta;

  const { data: link } = await supabase
    .from("campaign_influencers")
    .select("influencer_id")
    .eq("campaign_line_id", lineId)
    .eq("campaign_header_id", campaignId)
    .not("influencer_id", "is", null)
    .limit(1)
    .maybeSingle();

  return (link as { influencer_id?: string | null } | null)?.influencer_id ?? null;
}

/**
 * Batch-save Assignment commercial masters from the Commercial Workspace.
 * Preserves each line's platforms / pricing_mode and reuses updateCampaignLine
 * so deliverable sync + commercial SSOT gates stay on the one write path.
 */
export async function updateAssignmentLineCommercialsAction(
  input: z.infer<typeof inputSchema>
): Promise<UpdateAssignmentLineCommercialsResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid commercial update." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { campaignId, lines } = parsed.data;
  let updated = 0;
  const errors: string[] = [];

  for (const patch of lines) {
    const { data: existing, error } = await supabase
      .from("campaign_lines")
      .select(
        "id, name, platform, po_amount, currency_code, start_date, end_date, assignment_status, metadata, revenue_vat_percent, cost_vat_percent, revenue_vat_exempt, cost_vat_exempt, document_number, title_user_edited, fx_rate, cost_received, cost_received_currency, revenue_locked, cost_locked"
      )
      .eq("id", patch.lineId)
      .eq("campaign_header_id", campaignId)
      .maybeSingle();

    if (error || !existing) {
      errors.push(error?.message ?? `Line ${patch.lineId} not found.`);
      continue;
    }

    const row = existing as unknown as AssignmentLineRow;
    const assignment = parseLineAssignment(row.metadata);
    const influencerId = await resolveLineInfluencerId(
      supabase,
      patch.lineId,
      campaignId,
      row.metadata
    );

    if (!influencerId) {
      errors.push(`${row.document_number ?? patch.lineId}: missing creator.`);
      continue;
    }

    const pricingMode = assignment?.pricing_mode ?? "package";
    const platforms = assignment?.platforms ?? [];
    if (platforms.length === 0 && pricingMode !== "per_deliverable") {
      errors.push(
        `${row.document_number ?? patch.lineId}: no platforms on assignment — open the line sheet first.`
      );
      continue;
    }

    let commercialRows =
      pricingMode === "per_deliverable" && (assignment?.commercial_rows?.length ?? 0) > 0
        ? applyAssignmentCommercialToCommercialRows(
            assignment!.commercial_rows!,
            patch.revenue_before_vat,
            patch.cost_before_vat,
            patch.usage_rights_amount,
            patch.agency_fee_percent,
            patch.usage_rights_cost
          )
        : [];

    if (
      pricingMode === "per_deliverable" &&
      commercialRows.length === 0 &&
      platforms.length > 0
    ) {
      commercialRows = applyAssignmentCommercialToCommercialRows(
        packagePlatformsToCommercialRows(platforms, {
          totalRevenueBeforeVat: patch.revenue_before_vat,
          totalCostBeforeVat: patch.cost_before_vat,
          dueDate: row.end_date ?? row.start_date ?? null,
        }),
        patch.revenue_before_vat,
        patch.cost_before_vat,
        patch.usage_rights_amount,
        patch.agency_fee_percent,
        patch.usage_rights_cost
      );
    }

    if (pricingMode === "per_deliverable" && commercialRows.length === 0) {
      errors.push(
        `${row.document_number ?? patch.lineId}: no deliverable rows to update.`
      );
      continue;
    }

    const mutation: UpdateCampaignLineInput = {
      campaign_id: campaignId,
      line_id: patch.lineId,
      influencer_id: influencerId,
      assignment_json: JSON.stringify({ platforms }),
      pricing_mode: pricingMode,
      commercial_json:
        pricingMode === "per_deliverable" && commercialRows.length > 0
          ? JSON.stringify(commercialRows)
          : "",
      name: row.name ?? undefined,
      platform: row.platform ?? undefined,
      po_amount: Number(row.po_amount ?? 0),
      revenue: patch.revenue_before_vat,
      cost: patch.cost_before_vat,
      revenue_before_vat: patch.revenue_before_vat,
      cost_before_vat: patch.cost_before_vat,
      usage_rights_amount: patch.usage_rights_amount,
      usage_rights_cost: patch.usage_rights_cost,
      agency_fee_percent: patch.agency_fee_percent,
      revenue_vat_percent: Number(row.revenue_vat_percent ?? 0),
      cost_vat_percent: Number(row.cost_vat_percent ?? 0),
      revenue_vat_exempt: Boolean(row.revenue_vat_exempt),
      cost_vat_exempt: row.cost_vat_exempt ?? true,
      cost_received: row.cost_received ?? undefined,
      cost_received_currency: row.cost_received_currency ?? undefined,
      fx_rate: row.fx_rate ?? undefined,
      currency_code: row.currency_code ?? undefined,
      start_date: row.start_date,
      end_date: row.end_date,
      assignment_status: row.assignment_status ?? "assigned",
      title_user_edited: Boolean(row.title_user_edited),
      confirm_commercial_sync: true,
      commercial_sync_idempotency_key: `assignment-cw:${patch.lineId}:${campaignId}`,
    };

    const result = await updateCampaignLine(supabase, user.id, mutation);
    if (!result.ok) {
      errors.push(`${row.document_number ?? patch.lineId}: ${result.message}`);
      continue;
    }
    updated += 1;
  }

  if (updated > 0) {
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath("/campaigns", "layout");
    revalidatePath("/quotations");
    revalidatePath("/ios/vendor");
  }

  if (updated === 0) {
    return {
      ok: false,
      message: errors[0] ?? "No assignment commercials were updated.",
    };
  }

  return {
    ok: true,
    updated,
    message:
      errors.length > 0
        ? `Updated ${updated} line(s). Some failed: ${errors.slice(0, 2).join(" · ")}`
        : `Updated commercials for ${updated} assignment line(s).`,
  };
}
