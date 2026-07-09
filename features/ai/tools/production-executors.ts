import { getClientById } from "@/features/clients/queries";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { getCampaignWorkspace } from "@/lib/services/campaigns/campaign-workspace-service";
import { fetchBrandForCampaignCreate } from "@/lib/services/campaigns/repositories/campaign-repository";
import { isUuid } from "@/lib/validation/uuid";

import type { AiContext } from "../types";
import type {
  BuildCampaignInput,
  BuildCampaignOutput,
  GenerateBriefInput,
  GenerateBriefOutput,
  GetCampaignInput,
  GetCampaignOutput,
  GetClientInput,
  GetClientOutput,
  SearchCreatorsInput,
  SearchCreatorsOutput,
} from "./schemas";
import { parseCreatorSearchQuery } from "./creator-search-parser";
import {
  AI_SEARCH_CREATORS_PAGE_SIZE,
  resolveCreatorSearchFromInput,
  searchCreatorsInputToBrowseFilters,
} from "./search-creators-browse";
import { executeProgressiveCreatorSearch } from "./progressive-creator-search";
import { searchTrace, workflowTrace } from "@/lib/creators/search-trace";
import { dedupeByCreatorId } from "@/lib/creators/dedupe-creators";

import { requireToolAuthContext } from "./tool-auth";
import { searchCreatorsFromCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/services/search-creators-from-profile";
import { mapBrowseCreatorToSearchResult } from "@/features/campaign-studio/services/creator-platform-utils";

export async function executeSearchCreatorsProduction(
  input: SearchCreatorsInput,
  context: AiContext
): Promise<SearchCreatorsOutput> {
  const { supabase, userId } = await requireToolAuthContext();

  const profileId = context.campaignIntelligenceProfileId?.trim();
  if (profileId) {
    searchTrace("cip_search_start", { profileId, userId }, { path: "ai" });
    const result = await searchCreatorsFromCampaignIntelligenceProfile(
      supabase,
      profileId,
      input.limit ?? AI_SEARCH_CREATORS_PAGE_SIZE
    );
    const output = { creators: result.creators, total: result.total };
    workflowTrace("2_executeSearchCreatorsProduction", output, "toolOutput");
    return output;
  }

  const rawQuery = input.query.trim();
  const resolved = resolveCreatorSearchFromInput({ ...input, query: rawQuery || "creators" });
  const parsed = parseCreatorSearchQuery(rawQuery);
  const pageSize = input.limit ?? AI_SEARCH_CREATORS_PAGE_SIZE;

  searchTrace("1_parsed_creator_search", {
    rawQuery,
    parsed,
    useProgressiveSearch: resolved.useProgressiveSearch,
    campaignIntent: resolved.intent,
    userId,
  }, { path: "ai" });

  let result;
  try {
    if (resolved.useProgressiveSearch && resolved.intent) {
      try {
        const progressive = await executeProgressiveCreatorSearch(supabase, {
          intent: resolved.intent,
          pageSize,
          productionOnly: true,
          minFollowers: input.minFollowers ?? resolved.merged.minFollowers,
          maxFollowers: input.maxFollowers ?? resolved.merged.maxFollowers,
          minEngagement: input.minEngagement ?? resolved.merged.minEngagement,
          minThinkwayScore: input.minThinkwayScore,
          language: input.language,
          explicitPlatforms: input.platforms,
          explicitCategories: input.categories,
          explicitCountry: input.country,
        });
        result = progressive.browseResult;
        searchTrace("ers2_progressive_summary", {
          chosenStage: progressive.chosenStage,
          stagesAttempted: progressive.stagesAttempted,
        }, { path: "ai" });
      } catch (progressiveError) {
        searchTrace("ers2_progressive_error", {
          message:
            progressiveError instanceof Error
              ? progressiveError.message
              : String(progressiveError),
        }, { path: "ai" });
        const browseFilters = searchCreatorsInputToBrowseFilters({
          ...input,
          query: rawQuery || "creators",
          limit: pageSize,
        });
        result = await browseUnifiedCreators(supabase, browseFilters, "ai");
      }
    } else {
      const browseFilters = searchCreatorsInputToBrowseFilters({
        ...input,
        query: rawQuery || "creators",
        limit: pageSize,
      });
      searchTrace("3_unified_browse_filters", { browseFilters }, { path: "ai" });
      result = await browseUnifiedCreators(supabase, browseFilters, "ai");
    }
  } catch (error) {
    searchTrace("browse_error", {
      message: error instanceof Error ? error.message : String(error),
    }, { path: "ai" });
    throw error;
  }

  searchTrace("9_final_creator_count", {
    total: result.total,
    creatorCount: result.creators.length,
    internal_count: result.internal_count,
    discovery_count: result.discovery_count,
  }, { path: "ai" });

  const mappedCreators = result.creators.map((creator) =>
    mapBrowseCreatorToSearchResult(creator, input.platforms)
  );

  const { items: dedupedCreators } = dedupeByCreatorId(mappedCreators, (c) => c.id);

  const output = {
    creators: dedupedCreators,
    total: result.total,
  };

  workflowTrace("2_executeSearchCreatorsProduction", output, "toolOutput");

  return output;
}

export async function executeGetClientProduction(
  input: GetClientInput,
  context: AiContext
): Promise<GetClientOutput> {
  if (
    context.client?.id === input.clientId &&
    context.client.name &&
    isUuid(input.clientId)
  ) {
    return {
      id: context.client.id,
      name: context.client.name,
      groupId: context.client.groupId,
      country: context.client.country,
      brandCount: undefined,
    };
  }

  if (!isUuid(input.clientId)) {
    throw new Error(`Legal entity not found: ${input.clientId}`);
  }

  const client = await getClientById(input.clientId);
  if (!client) {
    throw new Error(`Legal entity not found: ${input.clientId}`);
  }

  return {
    id: client.id,
    name: client.name,
    groupId: client.group_id ?? undefined,
    country: client.country ?? undefined,
    brandCount: client.brands?.length ?? 0,
  };
}

export async function executeGetCampaignProduction(
  input: GetCampaignInput,
  context: AiContext
): Promise<GetCampaignOutput> {
  if (
    context.campaign?.id === input.campaignId &&
    context.campaign.name &&
    context.campaign.code
  ) {
    return {
      id: context.campaign.id,
      code: context.campaign.code,
      name: context.campaign.name,
      status: context.campaign.status ?? "unknown",
      brandId: context.campaign.brandId,
      clientId: context.campaign.clientId,
      poAmount: context.campaign.poAmount,
      currency: context.campaign.currency,
      lineCount: undefined,
    };
  }

  if (!isUuid(input.campaignId)) {
    throw new Error(`Campaign not found: ${input.campaignId}`);
  }

  const { supabase, userId } = await requireToolAuthContext();
  const workspace = await getCampaignWorkspace(supabase, userId, input.campaignId);

  if (!workspace) {
    throw new Error(`Campaign not found: ${input.campaignId}`);
  }

  return {
    id: workspace.id,
    code: workspace.document_number,
    name: workspace.name,
    status: workspace.status,
    brandId: workspace.brand?.id,
    clientId: workspace.client?.id,
    poAmount: workspace.financials.budget,
    currency: workspace.currency_code,
    lineCount: workspace.lines.length,
  };
}

export async function executeBuildCampaignProduction(
  input: BuildCampaignInput,
  _context: AiContext
): Promise<BuildCampaignOutput> {
  const { supabase } = await requireToolAuthContext();
  const { brand, error } = await fetchBrandForCampaignCreate(supabase, input.brandId);

  if (error || !brand) {
    throw new Error(error ?? `Brand not found: ${input.brandId}`);
  }

  const creatorIds = input.creatorIds ?? [];
  const lineCount = Math.max(creatorIds.length, 1);
  const poPerLine =
    input.poAmount != null
      ? Math.round(input.poAmount / lineCount)
      : undefined;

  const suggestedLines =
    creatorIds.length > 0
      ? creatorIds.map((creatorId, index) => ({
          code: String.fromCharCode(65 + index),
          creatorId,
          poAmount: poPerLine,
        }))
      : [{ code: "A", poAmount: input.poAmount }];

  return {
    draft: {
      brandId: brand.id,
      name: input.name,
      suggestedLines,
    },
  };
}

export async function executeGenerateBriefProduction(
  input: GenerateBriefInput,
  context: AiContext
): Promise<GenerateBriefOutput> {
  const campaignName =
    context.campaign?.id === input.campaignId
      ? context.campaign.name
      : undefined;

  if (isUuid(input.campaignId)) {
    try {
      const { supabase, userId } = await requireToolAuthContext();
      const workspace = await getCampaignWorkspace(supabase, userId, input.campaignId);

      if (workspace) {
        const sections: GenerateBriefOutput["sections"] = [];

        if (workspace.brief?.trim()) {
          sections.push({
            heading: "Campaign Brief",
            content: workspace.brief.trim(),
          });
        }

        sections.push({
          heading: "Objectives",
          content:
            workspace.description?.trim() ||
            "No campaign description on record. Confirm objectives with the account team.",
        });

        const deliverableSummary =
          workspace.deliverables.length > 0
            ? workspace.deliverables
                .slice(0, 8)
                .map(
                  (item) =>
                    `${item.deliverable_type}${item.platform ? ` (${item.platform})` : ""} — ${item.status}`
                )
                .join("; ")
            : workspace.lines.length > 0
              ? `${workspace.lines.length} campaign line(s) configured; deliverable specs pending assignment.`
              : "No deliverables recorded on campaign.";

        sections.push({
          heading: "Deliverables",
          content: deliverableSummary,
        });

        sections.push({
          heading: "Tone & Voice",
          content: input.tone?.trim()
            ? `Use a ${input.tone.trim()} tone aligned with brand guidelines.`
            : "Use a professional tone aligned with brand guidelines.",
        });

        return {
          title: `Creative Brief — ${workspace.name}`,
          sections,
        };
      }
    } catch {
      // Fall back to context snapshot when workspace load is unavailable.
    }
  }

  if (campaignName) {
    return {
      title: `Creative Brief — ${campaignName}`,
      sections: [
        {
          heading: "Objectives",
          content:
            "Campaign workspace details were not loaded. Confirm objectives in the campaign workspace.",
        },
        {
          heading: "Deliverables",
          content: "Deliverable specs not available from context snapshot.",
        },
      ],
    };
  }

  throw new Error(`Campaign not found: ${input.campaignId}`);
}
