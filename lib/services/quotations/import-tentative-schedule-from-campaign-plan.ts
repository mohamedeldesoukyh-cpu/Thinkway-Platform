import type { SupabaseClient } from "@supabase/supabase-js";

import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { logQuotationLifecycleEvent } from "@/lib/commercial-sync/audit";
import { isCommercialSyncEnabled } from "@/lib/commercial-sync/rules";
import {
  canGenerateFromCampaignPlan,
  parseCampaignPlanProvenance,
} from "@/lib/domains/commercial/campaign-plan-provenance";
import { extractTentativeScheduleFromCampaignPlan } from "@/lib/domains/commercial/campaign-plan-tentative-schedule";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { applyTentativeScheduleToQuotationItems } from "@/lib/domains/commercial/quotation-tentative-schedule";
import type { Database, QuotationStatus } from "@/types/database";

export type ImportTentativeScheduleFromCampaignPlanInput = {
  quotationId: string;
  campaignObjectId?: string | null;
  anchorStartDate?: string | null;
};

export type ImportTentativeScheduleFromCampaignPlanResult =
  | {
      ok: true;
      matchedItemCount: number;
      updatedDeliverableCount: number;
      message: string;
    }
  | { ok: false; message: string };

type QuotationRow = {
  id: string;
  status: QuotationStatus;
  campaign_object_id: string | null;
  source_campaign_object_version: number | null;
  issue_date: string | null;
};

type QuotationItemRow = {
  id: string;
  unified_id: string | null;
  creator_name: string | null;
  deliverables: unknown;
};

function parseDeliverables(raw: unknown): QuotationDeliverable[] {
  return Array.isArray(raw) ? (raw as QuotationDeliverable[]) : [];
}

export async function importTentativeScheduleFromCampaignPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: ImportTentativeScheduleFromCampaignPlanInput
): Promise<ImportTentativeScheduleFromCampaignPlanResult> {
  const quotationId = input.quotationId.trim();
  if (!quotationId) {
    return { ok: false, message: "Quotation id is required." };
  }

  const { data: quotationRaw, error: quotationError } = await supabase
    .from("quotations")
    .select("id, status, campaign_object_id, source_campaign_object_version, issue_date")
    .eq("id", quotationId)
    .maybeSingle();

  if (quotationError) return { ok: false, message: quotationError.message };
  const quotation = quotationRaw as QuotationRow | null;
  if (!quotation) return { ok: false, message: "Quotation not found." };

  const campaignObjectId =
    input.campaignObjectId?.trim() ||
    quotation.campaign_object_id?.trim() ||
    "";
  if (!campaignObjectId) {
    return {
      ok: false,
      message: "Quotation is not linked to a Campaign Plan.",
    };
  }

  const { data: head, error: headError } = await supabase
    .from("campaign_objects")
    .select("id, lifecycle_status, current_version")
    .eq("id", campaignObjectId)
    .maybeSingle();

  if (headError) return { ok: false, message: headError.message };
  if (!head) return { ok: false, message: "Campaign Plan not found." };

  const planApproved = canGenerateFromCampaignPlan(head.lifecycle_status);
  const quotationEditable = isCommercialSyncEnabled(quotation.status);
  if (!planApproved && !quotationEditable) {
    return {
      ok: false,
      message:
        "Import requires an approved Campaign Plan or an editable quotation in draft/under review.",
    };
  }
  if (!quotationEditable) {
    return {
      ok: false,
      message: "Tentative schedule can only be imported while the quotation is editable.",
    };
  }

  if (head.current_version <= 0) {
    return { ok: false, message: "Campaign Plan has no saved version to import from." };
  }

  const versionNumber =
    quotation.source_campaign_object_version != null &&
    quotation.campaign_object_id === campaignObjectId
      ? quotation.source_campaign_object_version
      : head.current_version;

  const version = await CampaignObjectPersistenceService.loadVersion(
    supabase,
    campaignObjectId,
    versionNumber
  );
  if (!version?.campaignObject) {
    return { ok: false, message: "Failed to load the Campaign Plan version." };
  }

  const scheduleByCreatorKey = extractTentativeScheduleFromCampaignPlan(
    version.campaignObject,
    {
      anchorStartDate: input.anchorStartDate,
      issueDate: quotation.issue_date,
    }
  );

  if (scheduleByCreatorKey.size === 0) {
    return {
      ok: false,
      message: "Campaign Plan media plan has no tentative posting schedule to import.",
    };
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("quotation_items")
    .select("id, unified_id, creator_name, deliverables")
    .eq("quotation_id", quotationId)
    .order("sort_order", { ascending: true });

  if (itemsError) return { ok: false, message: itemsError.message };

  const items = ((itemRows ?? []) as QuotationItemRow[]).map((row) => ({
    id: row.id,
    unified_id: row.unified_id,
    creator_name: row.creator_name,
    deliverables: parseDeliverables(row.deliverables),
  }));

  const { items: nextItems, matchedItemCount, updatedDeliverableCount } =
    applyTentativeScheduleToQuotationItems(items, scheduleByCreatorKey);

  if (matchedItemCount === 0) {
    return {
      ok: false,
      message: "No quotation lines matched creators from the Campaign Plan schedule.",
    };
  }

  const updateFailures: string[] = [];
  for (const item of nextItems) {
    if (!item.id) continue;
    const { error } = await supabase
      .from("quotation_items")
      .update({ deliverables: item.deliverables as never })
      .eq("id", item.id);
    if (error) updateFailures.push(error.message);
  }

  if (updateFailures.length === nextItems.filter((item) => item.id).length) {
    return {
      ok: false,
      message: updateFailures[0] ?? "Failed to update quotation deliverables.",
    };
  }

  const provenance = parseCampaignPlanProvenance({
    campaign_object_id: campaignObjectId,
    source_campaign_object_version: versionNumber,
  });

  await logQuotationLifecycleEvent(supabase, {
    quotationId,
    actorId: userId,
    event: "quotation.tentative_schedule_imported",
    summary: `Imported tentative posting schedule for ${matchedItemCount} creator line(s).`,
    metadata: {
      campaign_object_id: provenance?.campaignObjectId ?? campaignObjectId,
      source_campaign_object_version: provenance?.sourceCampaignObjectVersion ?? versionNumber,
      matched_item_count: matchedItemCount,
      updated_deliverable_count: updatedDeliverableCount,
      plan_lifecycle_status: head.lifecycle_status,
      update_failures: updateFailures.length,
    },
    newData: {
      matched_item_count: matchedItemCount,
      updated_deliverable_count: updatedDeliverableCount,
    },
  });

  const message =
    updateFailures.length > 0
      ? `Tentative schedule imported for ${matchedItemCount} line(s); ${updateFailures.length} update(s) failed.`
      : `Tentative posting schedule imported for ${matchedItemCount} creator line(s).`;

  return {
    ok: true,
    matchedItemCount,
    updatedDeliverableCount,
    message,
  };
}
