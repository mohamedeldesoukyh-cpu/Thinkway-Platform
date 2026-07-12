import type { SupabaseClient } from "@supabase/supabase-js";

import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { hydrateSlateCreators } from "@/features/campaign-studio/services/copilot/slate-edit-mutations";
import { normalizeCreatorId } from "@/features/campaign-studio/services/studio-draft";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { logQuotationLifecycleEvent } from "@/lib/commercial-sync/audit";
import {
  canGenerateFromCampaignPlan,
  parseCampaignPlanProvenance,
} from "@/lib/domains/commercial/campaign-plan-provenance";
import {
  mapCampaignPlanToQuotationHeaderSeed,
  mapCampaignPlanToQuotationItemSeeds,
} from "@/lib/domains/commercial/campaign-plan-quotation-mapper";
import { promoteDiscoveredProfileToInfluencer } from "@/lib/discovery/promote-profile";
import type { Database } from "@/types/database";

import { recomputeQuotationTotals } from "./quotation-commercial-service";
import {
  appendQuotationRevision,
  insertQuotationHeaderRecord,
} from "./repositories/quotation-repository";
import {
  buildItemInsertRows,
  insertQuotationItems,
} from "./repositories/quotation-item-repository";
import { fetchBrandForCampaignCreate } from "../campaigns/repositories/campaign-repository";

export type GenerateQuotationFromCampaignPlanInput = {
  campaignObjectId: string;
  brandId?: string | null;
  quotationName?: string | null;
  conversationId?: string | null;
  anchorStartDate?: string | null;
};

export type GenerateQuotationFromCampaignPlanResult =
  | {
      ok: true;
      quotationId: string;
      serialNumber: string | null;
      itemsCreated: number;
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

async function linkConversationWorkspace(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  quotationId: string
) {
  await supabase
    .from("ai_conversations")
    .update({
      workspace_type: "quotation",
      workspace_id: quotationId,
    } as never)
    .eq("id", conversationId);
}

/**
 * Generates a commercial quotation from an approved Campaign Plan snapshot.
 * Tentative schedule is applied during mapping — not via a separate import step.
 */
export async function generateQuotationFromCampaignPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: GenerateQuotationFromCampaignPlanInput
): Promise<GenerateQuotationFromCampaignPlanResult> {
  const campaignObjectId = input.campaignObjectId.trim();
  if (!campaignObjectId) {
    return { ok: false, message: "Campaign Plan id is required." };
  }

  const { data: head, error: headError } = await supabase
    .from("campaign_objects")
    .select("id, lifecycle_status, current_version, conversation_id")
    .eq("id", campaignObjectId)
    .maybeSingle();

  if (headError) return { ok: false, message: headError.message };
  if (!head) return { ok: false, message: "Campaign Plan not found." };

  if (!canGenerateFromCampaignPlan(head.lifecycle_status)) {
    return {
      ok: false,
      message: "Only approved Campaign Plans can generate a quotation.",
    };
  }

  if (head.current_version <= 0) {
    return { ok: false, message: "Campaign Plan has no saved version to generate from." };
  }

  const { data: existingQuotation } = await supabase
    .from("quotations")
    .select("id, serial_number")
    .eq("campaign_object_id", campaignObjectId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingQuotation) {
    return {
      ok: true,
      quotationId: existingQuotation.id,
      serialNumber: existingQuotation.serial_number,
      itemsCreated: 0,
      alreadyExists: true,
      message: `Quotation ${existingQuotation.serial_number ?? existingQuotation.id} already exists for this Campaign Plan.`,
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
      message: "Select a brand before generating the quotation.",
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

  const facts = getCampaignFacts(version.campaignObject);
  const contextText = facts?.rawBriefExcerpt?.trim() || "";
  const headerSeed = mapCampaignPlanToQuotationHeaderSeed(version.campaignObject, contextText);
  const itemSeeds = mapCampaignPlanToQuotationItemSeeds({
    campaignObject: version.campaignObject,
    creators: hydratedCreators,
    influencerIdByCreatorId,
    contextText,
    anchorStartDate: input.anchorStartDate,
  });

  if (itemSeeds.length === 0) {
    return {
      ok: false,
      message: "No approved slate creators could be resolved to quotation lines.",
    };
  }

  const provenance = parseCampaignPlanProvenance({
    campaign_object_id: campaignObjectId,
    source_campaign_object_version: head.current_version,
  });

  const { data: header, error: headerError } = await insertQuotationHeaderRecord(
    supabase,
    userId,
    {
      name: input.quotationName?.trim() || headerSeed.name,
      client_id: brand.client_id,
      brand_id: brand.id,
      notes: headerSeed.notes,
      campaign_object_id: provenance?.campaignObjectId ?? campaignObjectId,
      source_campaign_object_version:
        provenance?.sourceCampaignObjectVersion ?? head.current_version,
    }
  );

  if (headerError || !header) {
    return {
      ok: false,
      message: headerError?.message ?? "Failed to create quotation header.",
    };
  }

  const quotationId = (header as { id: string }).id;

  const rows = await buildItemInsertRows(supabase, quotationId, itemSeeds, 0);
  const { error: itemsError } = await insertQuotationItems(supabase, rows);
  if (itemsError) {
    await supabase.from("quotations").delete().eq("id", quotationId);
    return {
      ok: false,
      message: itemsError.message ?? "Failed to create quotation lines.",
    };
  }

  await recomputeQuotationTotals(supabase, quotationId);

  await appendQuotationRevision(supabase, {
    quotationId,
    userId,
    version: "v1.0",
    changeSummary: "Quotation generated from approved Campaign Plan",
  });

  const conversationId = input.conversationId ?? head.conversation_id;
  if (conversationId) {
    await linkConversationWorkspace(supabase, conversationId, quotationId);
  }

  const { data: serialRow } = await supabase
    .from("quotations")
    .select("serial_number")
    .eq("id", quotationId)
    .maybeSingle();

  await logQuotationLifecycleEvent(supabase, {
    quotationId,
    actorId: userId,
    event: "quotation.generated_from_campaign_plan",
    summary: `Generated quotation from approved Campaign Plan with ${rows.length} creator line(s).`,
    metadata: {
      campaign_object_id: provenance?.campaignObjectId ?? campaignObjectId,
      source_campaign_object_version:
        provenance?.sourceCampaignObjectVersion ?? head.current_version,
      items_created: rows.length,
      campaign_name: headerSeed.campaignName,
    },
    newData: {
      serial_number: (serialRow as { serial_number?: string | null } | null)?.serial_number ?? null,
      items_created: rows.length,
    },
  });

  return {
    ok: true,
    quotationId,
    serialNumber:
      (serialRow as { serial_number?: string | null } | null)?.serial_number ?? null,
    itemsCreated: rows.length,
    alreadyExists: false,
    message: `Quotation created with ${rows.length} creator line(s) from the approved Campaign Plan.`,
  };
}
