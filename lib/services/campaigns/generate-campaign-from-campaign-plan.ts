import type { SupabaseClient } from "@supabase/supabase-js";

import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { hydrateSlateCreators } from "@/features/campaign-studio/services/copilot/slate-edit-mutations";
import { normalizeCreatorId } from "@/features/campaign-studio/services/studio-draft";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { logAuditEvent } from "@/lib/audit/log-audit-event";
import {
  canGenerateFromCampaignPlan,
  parseCampaignPlanProvenance,
} from "@/lib/domains/commercial/campaign-plan-provenance";
import {
  mapCampaignPlanToLineSeeds,
  resolveCampaignNameFromPlan,
} from "@/lib/domains/commercial/campaign-plan-execution-mapper";
import { promoteDiscoveredProfileToInfluencer } from "@/lib/discovery/promote-profile";
import { METADATA_PLATFORM_KEY } from "@/lib/campaigns/constants";
import type { Database } from "@/types/database";

import { createCampaignLine } from "./campaign-line-service";
import {
  fetchBrandForCampaignCreate,
  insertCampaignHeader,
  updateCampaignPoFields,
} from "./repositories/campaign-repository";

export type GenerateCampaignFromCampaignPlanInput = {
  campaignObjectId: string;
  brandId?: string | null;
  campaignName?: string | null;
  conversationId?: string | null;
};

export type GenerateCampaignFromCampaignPlanResult =
  | {
      ok: true;
      campaignId: string;
      documentNumber: string;
      linesCreated: number;
      alreadyExists: boolean;
      message: string;
    }
  | { ok: false; message: string };

async function resolveBrandId(
  supabase: SupabaseClient<Database>,
  input: {
    brandId?: string | null;
    conversationId?: string | null;
  }
): Promise<string | null> {
  if (input.brandId?.trim()) return input.brandId.trim();
  if (!input.conversationId) return null;

  const { data: conversation, error } = await supabase
    .from("ai_conversations")
    .select("workspace_type, workspace_id")
    .eq("id", input.conversationId)
    .maybeSingle();

  const row = conversation as {
    workspace_type?: string;
    workspace_id?: string | null;
  } | null;

  if (error || !row?.workspace_id) return null;

  const workspaceType = row.workspace_type;
  const workspaceId = row.workspace_id;

  if (workspaceType === "quotation") {
    const { data: quotation } = await supabase
      .from("quotations")
      .select("brand_id")
      .eq("id", workspaceId)
      .maybeSingle();
    return (quotation as { brand_id?: string | null } | null)?.brand_id ?? null;
  }

  if (workspaceType === "shortlist") {
    const { data: shortlist } = await supabase
      .from("discovery_shortlists")
      .select("brand_id")
      .eq("id", workspaceId)
      .maybeSingle();
    return (shortlist as { brand_id?: string | null } | null)?.brand_id ?? null;
  }

  return null;
}

async function resolveInfluencerIds(
  supabase: SupabaseClient<Database>,
  userId: string,
  creators: Awaited<ReturnType<typeof hydrateSlateCreators>>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const creator of creators) {
    const key = normalizeCreatorId(creator.unified_id);
    if (creator.influencer_id) {
      map.set(key, creator.influencer_id);
      continue;
    }

    if (creator.discovered_profile_id) {
      const promotion = await promoteDiscoveredProfileToInfluencer(
        supabase,
        creator.discovered_profile_id,
        userId
      );
      if (promotion.ok) {
        map.set(key, promotion.influencerId);
      }
    }
  }

  return map;
}

function addDaysIso(base: string, days: number): string {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolvePlanDates(campaignObject: import("@/features/campaign-intelligence").CampaignObject): {
  startDate: string | null;
  endDate: string | null;
} {
  const facts = getCampaignFacts(campaignObject);
  const durationWeeks = facts?.durationWeeks;
  const startDate = new Date().toISOString().slice(0, 10);
  const endDate =
    durationWeeks && durationWeeks > 0
      ? addDaysIso(startDate, durationWeeks * 7)
      : null;
  return { startDate, endDate };
}

/**
 * Generates an operational campaign (header + lines + deliverables) from an
 * approved Campaign Plan snapshot. Independent from quotation promotion.
 */
export async function generateCampaignFromCampaignPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: GenerateCampaignFromCampaignPlanInput
): Promise<GenerateCampaignFromCampaignPlanResult> {
  const campaignObjectId = input.campaignObjectId.trim();
  if (!campaignObjectId) {
    return { ok: false, message: "Campaign Plan id is required." };
  }

  const { data: head, error: headError } = await supabase
    .from("campaign_objects")
    .select("id, lifecycle_status, current_version, campaign_header_id, conversation_id")
    .eq("id", campaignObjectId)
    .maybeSingle();

  if (headError) return { ok: false, message: headError.message };
  if (!head) return { ok: false, message: "Campaign Plan not found." };

  if (!canGenerateFromCampaignPlan(head.lifecycle_status)) {
    return {
      ok: false,
      message: "Only approved Campaign Plans can generate an execution campaign.",
    };
  }

  if (head.current_version <= 0) {
    return { ok: false, message: "Campaign Plan has no saved version to generate from." };
  }

  const { data: existingHeader } = await supabase
    .from("campaign_headers")
    .select("id, document_number")
    .eq("campaign_object_id", campaignObjectId)
    .maybeSingle();

  if (existingHeader) {
    return {
      ok: true,
      campaignId: existingHeader.id,
      documentNumber: existingHeader.document_number,
      linesCreated: 0,
      alreadyExists: true,
      message: `Execution campaign ${existingHeader.document_number} already exists for this Campaign Plan.`,
    };
  }

  const version = await CampaignObjectPersistenceService.loadVersion(
    supabase,
    campaignObjectId,
    head.current_version
  );
  if (!version?.campaignObject) {
    return { ok: false, message: "Failed to load the approved Campaign Plan version." };
  }

  const brandId = await resolveBrandId(supabase, {
    brandId: input.brandId,
    conversationId: input.conversationId ?? head.conversation_id,
  });
  if (!brandId) {
    return {
      ok: false,
      message: "Select a brand before generating the execution campaign.",
    };
  }

  const { brand, error: brandError } = await fetchBrandForCampaignCreate(supabase, brandId);
  if (brandError || !brand) {
    return { ok: false, message: brandError ?? "Brand not found." };
  }

  const hydratedCreators = await hydrateSlateCreators(supabase, version.campaignObject);
  const influencerIdByCreatorId = await resolveInfluencerIds(
    supabase,
    userId,
    hydratedCreators
  );

  const lineSeeds = mapCampaignPlanToLineSeeds({
    campaignObject: version.campaignObject,
    creators: hydratedCreators,
    influencerIdByCreatorId,
  });

  if (lineSeeds.length === 0) {
    return {
      ok: false,
      message: "No approved slate creators could be resolved to campaign lines.",
    };
  }

  const facts = getCampaignFacts(version.campaignObject);
  const campaignName =
    input.campaignName?.trim() || resolveCampaignNameFromPlan(version.campaignObject);
  const { startDate, endDate } = resolvePlanDates(version.campaignObject);
  const currencyCode = facts?.budget?.currency ?? brand.currency_code;
  const poAmount = Math.round(facts?.budget?.amount ?? 0);
  const platform = facts?.platforms?.[0] ?? null;
  const metadata = platform ? { [METADATA_PLATFORM_KEY]: platform } : {};

  const provenance = parseCampaignPlanProvenance({
    campaign_object_id: campaignObjectId,
    source_campaign_object_version: head.current_version,
  });

  const { data: header, error: headerError } = await insertCampaignHeader(supabase, {
    name: campaignName,
    brand,
    status: "planning",
    currency_code: currencyCode,
    start_date: startDate,
    end_date: endDate,
    account_manager_id: null,
    metadata,
    created_by: userId,
    campaign_object_id: provenance?.campaignObjectId ?? campaignObjectId,
    source_campaign_object_version: provenance?.sourceCampaignObjectVersion ?? head.current_version,
  });

  if (headerError || !header) {
    return {
      ok: false,
      message: headerError?.message ?? "Failed to create execution campaign header.",
    };
  }

  if (poAmount > 0) {
    await updateCampaignPoFields(supabase, header.id, {
      currency: currencyCode,
      fxRate: 1,
      poAmount,
    });
  }

  let linesCreated = 0;
  const lineFailures: string[] = [];

  for (const seed of lineSeeds) {
    const result = await createCampaignLine(supabase, userId, {
      campaign_id: header.id,
      influencer_id: seed.influencerId,
      assignment_json: JSON.stringify({ platforms: seed.platforms }),
      pricing_mode: "package",
      name: seed.displayName,
      po_amount: seed.revenue,
      revenue: seed.revenue,
      cost: seed.cost,
      revenue_before_vat: seed.revenue,
      cost_before_vat: seed.cost,
      usage_rights_amount: 0,
      usage_rights_cost: 0,
      agency_fee_percent: 0,
      revenue_vat_percent: 0,
      cost_vat_percent: 0,
      currency_code: seed.currencyCode,
      start_date: startDate,
      end_date: endDate,
      assignment_status: "assigned",
    });

    if (result.ok) {
      linesCreated += 1;
    } else {
      lineFailures.push(result.message);
    }
  }

  if (linesCreated === 0) {
    await supabase.from("campaign_headers").delete().eq("id", header.id);
    return {
      ok: false,
      message: lineFailures[0] ?? "Failed to create campaign lines from the Campaign Plan.",
    };
  }

  await supabase
    .from("campaign_objects")
    .update({
      campaign_header_id: header.id,
      updated_by: userId,
    })
    .eq("id", campaignObjectId);

  await logAuditEvent(supabase, {
    userId,
    action: "create",
    entityType: "campaign_header",
    entityId: header.id,
    metadata: {
      audit_action: "campaign_generated_from_plan",
      campaign_object_id: campaignObjectId,
      source_campaign_object_version: head.current_version,
      lines_created: linesCreated,
      line_failures: lineFailures.length,
    },
    newData: {
      document_number: header.document_number,
      campaign_object_id: campaignObjectId,
    },
  });

  const message =
    lineFailures.length > 0
      ? `Campaign ${header.document_number} created with ${linesCreated} line(s). ${lineFailures.length} creator(s) could not be added.`
      : `Campaign ${header.document_number} created with ${linesCreated} vendor line(s).`;

  return {
    ok: true,
    campaignId: header.id,
    documentNumber: header.document_number,
    linesCreated,
    alreadyExists: false,
    message,
  };
}
