"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyAssignmentCommercialToCommercialRows } from "@/lib/assignments/commercial-calculations";
import { packagePlatformsToCommercialRows } from "@/lib/assignments/sync-package-deliverables";
import { lineAssignmentPayloadSchema } from "@/lib/campaigns/schemas";
import {
  parseLineAssignment,
  type LinePlatformSelection,
} from "@/lib/campaigns/line-assignment";
import {
  updateCampaignLine,
  type UpdateCampaignLineInput,
} from "@/lib/services/campaigns/campaign-line-service";
import { fetchCampaignLineById } from "@/lib/services/campaigns/repositories/campaign-repository";
import { financeLockConfirmationCopy } from "@/lib/services/commercial/confirmation-copy";
import { probeCommercialLinkByAssignment } from "@/lib/services/commercial/probe-commercial-link";
import type { MasterCommercialValues } from "@/lib/services/commercial/types";
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

export type AssignmentCommercialRevisionLine = {
  commercialLineId: string;
  assignmentIds: string[];
  concurrencyToken: string | null;
  current: MasterCommercialValues;
  proposed: MasterCommercialValues;
};

export type UpdateAssignmentLineCommercialsResult =
  | { ok: true; updated: number; message: string }
  | {
      ok: false;
      message: string;
      code?: string;
      quotationId?: string | null;
      revisionLines?: AssignmentCommercialRevisionLine[];
      confirmationTitle?: string;
      confirmationDescription?: string;
      confirmLabel?: string;
    };

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
  document_number: string | null;
  cost_received?: number | null;
  cost_received_currency?: string | null;
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

/** Ensure platforms satisfy lineAssignmentPayloadSchema for package updates. */
function normalizePlatformsForMutation(
  platforms: LinePlatformSelection[]
): LinePlatformSelection[] {
  return platforms
    .filter(
      (platform) =>
        Boolean(platform.account_id?.trim()) &&
        Boolean(platform.platform?.trim()) &&
        Boolean(platform.handle?.trim())
    )
    .map((platform) => ({
      ...platform,
      deliverables:
        Array.isArray(platform.deliverables) && platform.deliverables.length > 0
          ? platform.deliverables
          : ["other"],
    }));
}

/**
 * Batch-save Assignment commercial masters from the Commercial Workspace.
 * Reuses updateCampaignLine so deliverable sync + commercial SSOT gates stay on one write path.
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
  const successNotes: string[] = [];
  const errors: string[] = [];
  let lastCode: string | undefined;

  for (const patch of lines) {
    try {
      // Proven select used by updateCampaignLine (locks / VAT / commercial masters).
      const { data: existingMeta, error: metaError } = await fetchCampaignLineById(
        supabase,
        patch.lineId,
        campaignId
      );
      if (metaError || !existingMeta) {
        errors.push(metaError?.message ?? `Line ${patch.lineId} not found.`);
        continue;
      }

      // Operational fields only — never invent columns (no influencer_id / title_user_edited).
      const { data: existingOps, error: opsError } = await supabase
        .from("campaign_lines")
        .select(
          "id, name, platform, po_amount, currency_code, start_date, end_date, assignment_status, metadata, document_number, cost_received, cost_received_currency"
        )
        .eq("id", patch.lineId)
        .eq("campaign_header_id", campaignId)
        .maybeSingle();

      if (opsError || !existingOps) {
        errors.push(opsError?.message ?? `Line ${patch.lineId} not found.`);
        continue;
      }

      const row = existingOps as unknown as AssignmentLineRow;
      const meta = existingMeta as {
        metadata?: Record<string, unknown> | null;
        revenue_vat_percent?: number | null;
        cost_vat_percent?: number | null;
        revenue_vat_exempt?: boolean | null;
        cost_vat_exempt?: boolean | null;
        fx_rate?: number | null;
        currency_code?: string | null;
        document_number?: string | null;
      };

      const metadata = (row.metadata ?? meta.metadata ?? null) as Record<
        string,
        unknown
      > | null;
      const assignment = parseLineAssignment(metadata);
      const influencerId = await resolveLineInfluencerId(
        supabase,
        patch.lineId,
        campaignId,
        metadata
      );

      if (!influencerId) {
        errors.push(
          `${row.document_number ?? meta.document_number ?? patch.lineId}: missing creator.`
        );
        continue;
      }

      const pricingMode = assignment?.pricing_mode ?? "package";
      const platforms = normalizePlatformsForMutation(assignment?.platforms ?? []);

      if (pricingMode !== "per_deliverable") {
        const platformsOk = lineAssignmentPayloadSchema.safeParse({ platforms });
        if (!platformsOk.success) {
          errors.push(
            `${row.document_number ?? patch.lineId}: open the line sheet and confirm platforms/deliverables before Commercial Workspace save.`
          );
          continue;
        }
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

      // Unique per save — static keys cause stale commercial-sync idempotency / false success.
      const idempotencyKey = `assignment-cw:${patch.lineId}:${campaignId}:${patch.cost_before_vat}:${patch.revenue_before_vat}:${patch.agency_fee_percent}:${patch.usage_rights_amount}:${patch.usage_rights_cost}:${crypto.randomUUID()}`;

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
        revenue_vat_percent: Number(meta.revenue_vat_percent ?? 0),
        cost_vat_percent: Number(meta.cost_vat_percent ?? 0),
        revenue_vat_exempt: Boolean(meta.revenue_vat_exempt),
        cost_vat_exempt: meta.cost_vat_exempt ?? true,
        cost_received: row.cost_received ?? undefined,
        cost_received_currency: row.cost_received_currency ?? undefined,
        fx_rate: meta.fx_rate ?? undefined,
        currency_code: row.currency_code ?? meta.currency_code ?? undefined,
        start_date: row.start_date,
        end_date: row.end_date,
        assignment_status: row.assignment_status ?? "assigned",
        title_user_edited: Boolean(assignment?.title_user_edited),
        confirm_commercial_sync: true,
        commercial_sync_idempotency_key: idempotencyKey,
      };

      const result = await updateCampaignLine(supabase, user.id, mutation);
      if (!result.ok) {
        lastCode = result.code;

        if (result.code === "FINANCE_LOCKED") {
          const copy = financeLockConfirmationCopy();
          const revisionLines: AssignmentCommercialRevisionLine[] = [];
          let quotationId: string | null = null;

          for (const lockedPatch of lines) {
            const probe = await probeCommercialLinkByAssignment(
              supabase,
              lockedPatch.lineId
            );
            if (!probe.linked || !probe.commercialLineId) continue;
            quotationId = quotationId ?? probe.quotationId;

            const { data: lockedMeta } = await fetchCampaignLineById(
              supabase,
              lockedPatch.lineId,
              campaignId
            );
            const currentRow = lockedMeta as {
              cost_before_vat?: number | null;
              cost?: number | null;
              revenue_before_vat?: number | null;
              revenue?: number | null;
              currency_code?: string | null;
              agency_fee_percent?: number | null;
              usage_rights_amount?: number | null;
              usage_rights_cost?: number | null;
              revenue_vat_percent?: number | null;
              cost_vat_percent?: number | null;
              revenue_vat_exempt?: boolean | null;
              cost_vat_exempt?: boolean | null;
              fx_rate?: number | null;
            } | null;

            revisionLines.push({
              commercialLineId: probe.commercialLineId,
              assignmentIds: probe.assignmentIds.length
                ? probe.assignmentIds
                : [lockedPatch.lineId],
              concurrencyToken: probe.concurrencyToken,
              current: {
                creator_cost: Number(
                  currentRow?.cost_before_vat ?? currentRow?.cost ?? 0
                ),
                client_revenue: Number(
                  currentRow?.revenue_before_vat ?? currentRow?.revenue ?? 0
                ),
                cost_currency: currentRow?.currency_code ?? "EGP",
                agency_fee_percent: Number(currentRow?.agency_fee_percent ?? 0),
                usage_rights_amount: Number(currentRow?.usage_rights_amount ?? 0),
                usage_rights_cost: Number(currentRow?.usage_rights_cost ?? 0),
                revenue_vat_percent: Number(currentRow?.revenue_vat_percent ?? 0),
                cost_vat_percent: Number(currentRow?.cost_vat_percent ?? 0),
                revenue_vat_exempt: Boolean(currentRow?.revenue_vat_exempt),
                cost_vat_exempt: currentRow?.cost_vat_exempt ?? true,
                exchange_rate: currentRow?.fx_rate ?? undefined,
              },
              proposed: {
                creator_cost: lockedPatch.cost_before_vat,
                client_revenue: lockedPatch.revenue_before_vat,
                cost_currency: currentRow?.currency_code ?? "EGP",
                agency_fee_percent: lockedPatch.agency_fee_percent,
                usage_rights_amount: lockedPatch.usage_rights_amount,
                usage_rights_cost: lockedPatch.usage_rights_cost,
                revenue_vat_percent: Number(currentRow?.revenue_vat_percent ?? 0),
                cost_vat_percent: Number(currentRow?.cost_vat_percent ?? 0),
                revenue_vat_exempt: Boolean(currentRow?.revenue_vat_exempt),
                cost_vat_exempt: currentRow?.cost_vat_exempt ?? true,
                exchange_rate: currentRow?.fx_rate ?? undefined,
              },
            });
          }

          return {
            ok: false,
            code: "FINANCE_LOCKED",
            message:
              result.commercialSync?.confirmationDescription ??
              result.message ??
              copy.description,
            confirmationTitle:
              result.commercialSync?.confirmationTitle ?? copy.title,
            confirmationDescription:
              result.commercialSync?.confirmationDescription ?? copy.description,
            confirmLabel: copy.confirmLabel,
            quotationId,
            revisionLines,
          };
        }

        const detail =
          result.commercialSync?.confirmationDescription ?? result.message;
        errors.push(
          `${row.document_number ?? meta.document_number ?? patch.lineId}: ${detail}`
        );
        continue;
      }

      updated += 1;
      if (
        result.message.toLowerCase().includes("revision required") ||
        result.message.toLowerCase().includes("re-approval")
      ) {
        successNotes.push(result.message);
      }
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : `Line ${patch.lineId}: unexpected save failure.`
      );
    }
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
      code: lastCode,
    };
  }

  const base =
    errors.length > 0
      ? `Updated ${updated} line(s). Some failed: ${errors.slice(0, 2).join(" · ")}`
      : `Updated commercials for ${updated} assignment line(s).`;

  return {
    ok: true,
    updated,
    message: successNotes[0] ? `${base} ${successNotes[0]}` : base,
  };
}
