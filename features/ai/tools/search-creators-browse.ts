import { searchTrace } from "@/lib/creators/search-trace";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

import {
  buildCampaignSearchIntent,
  looksLikeCampaignBrief,
} from "./campaign-search-intent";
import { parseCreatorSearchQuery } from "./creator-search-parser";
import type { SearchCreatorsInput } from "./schemas";
import { resolveDiscoveryPlatform } from "@/lib/social/platforms";

/** Default page size aligned with Discovery search workspace. */
export const AI_SEARCH_CREATORS_PAGE_SIZE = 50;

export {
  assertBrowseFilterParity,
  normalizeAiCreatorSearchQuery,
  parseCreatorSearchQuery,
} from "./creator-search-parser";
export { buildCampaignSearchIntent, looksLikeCampaignBrief } from "./campaign-search-intent";

/**
 * Explicit platforms come from stored campaign facts, which are title-case
 * ("TikTok"). The parser already canonicalizes platforms to the lowercase enum
 * value, so normalize the explicit ones the same way here — otherwise the raw
 * title-case value overwrites the canonical one and reaches the discovery enum
 * boundary as an invalid value. Reuses the shared resolveDiscoveryPlatform.
 */
function explicitPlatformsFromInput(platforms?: string[]): string[] {
  return (
    platforms
      ?.map((value) => resolveDiscoveryPlatform(value) ?? value.trim())
      .filter(Boolean) ?? []
  );
}

function mergeParsedWithInput(input: SearchCreatorsInput) {
  const parsed = parseCreatorSearchQuery(input.query);
  const explicitPlatforms = explicitPlatformsFromInput(input.platforms);
  const explicitCategories =
    input.categories?.map((value) => value.trim()).filter(Boolean) ?? [];

  return {
    search: parsed.search || input.query.trim(),
    country: input.country?.trim() || parsed.country,
    platforms: explicitPlatforms.length > 0 ? explicitPlatforms : parsed.platforms,
    categories: explicitCategories.length > 0 ? explicitCategories : parsed.categories,
    minFollowers: input.minFollowers ?? parsed.minFollowers,
    maxFollowers: input.maxFollowers ?? parsed.maxFollowers,
    minEngagement: input.minEngagement ?? parsed.minEngagement,
  };
}

function mergedFromCampaignIntent(input: SearchCreatorsInput) {
  const intent = buildCampaignSearchIntent(input.query);
  const explicitPlatforms = explicitPlatformsFromInput(input.platforms);
  const explicitCategories =
    input.categories?.map((value) => value.trim()).filter(Boolean) ?? [];

  return {
    intent,
    search: intent.semanticKeywords.slice(0, 3).join(" ") || undefined,
    country: input.country?.trim() || intent.country,
    platforms:
      explicitPlatforms.length > 0 ? explicitPlatforms : intent.platforms,
    categories:
      explicitCategories.length > 0 ? explicitCategories : intent.categories,
    minFollowers: input.minFollowers ?? intent.parsed.minFollowers,
    maxFollowers: input.maxFollowers ?? intent.parsed.maxFollowers,
    minEngagement: input.minEngagement ?? intent.parsed.minEngagement,
  };
}

export function resolveCreatorSearchFromInput(input: SearchCreatorsInput): {
  useProgressiveSearch: boolean;
  intent?: ReturnType<typeof buildCampaignSearchIntent>;
  merged: ReturnType<typeof mergeParsedWithInput>;
} {
  if (looksLikeCampaignBrief(input.query)) {
    const campaign = mergedFromCampaignIntent(input);
    return {
      useProgressiveSearch: true,
      intent: campaign.intent,
      merged: {
        search: campaign.search ?? "",
        country: campaign.country,
        platforms: campaign.platforms,
        categories: campaign.categories,
        minFollowers: campaign.minFollowers,
        maxFollowers: campaign.maxFollowers,
        minEngagement: campaign.minEngagement,
      },
    };
  }

  const merged = mergeParsedWithInput(input);
  return {
    useProgressiveSearch: false,
    merged,
  };
}

export function searchCreatorsInputToBrowseFilters(
  input: SearchCreatorsInput
): UnifiedCreatorBrowseFilters {
  const parsed = parseCreatorSearchQuery(input.query);
  const resolved = resolveCreatorSearchFromInput(input);
  const merged = resolved.merged;
  const platforms = merged.platforms ?? [];

  searchTrace("2_creator_search_filters_merged", {
    input: {
      query: input.query,
      country: input.country,
      platforms: input.platforms,
      categories: input.categories,
      minFollowers: input.minFollowers,
      maxFollowers: input.maxFollowers,
      minEngagement: input.minEngagement,
      limit: input.limit,
    },
    parsed,
    merged,
    useProgressiveSearch: resolved.useProgressiveSearch,
    campaignIntent: resolved.intent
      ? {
          industry: resolved.intent.industry,
          industryKey: resolved.intent.industryKey,
          categories: resolved.intent.categories,
          country: resolved.intent.country,
          platforms: resolved.intent.platforms,
        }
      : undefined,
  }, { path: "ai" });

  return {
    search: merged.search || undefined,
    platform: platforms.length === 1 ? platforms[0] : undefined,
    platforms: platforms.length > 1 ? platforms : undefined,
    country: merged.country || undefined,
    language: input.language?.trim() || undefined,
    categories: merged.categories?.length ? merged.categories : undefined,
    minFollowers: merged.minFollowers,
    maxFollowers: merged.maxFollowers,
    minEngagement: merged.minEngagement,
    minThinkwayScore: input.minThinkwayScore,
    productionOnly: true,
    pageSize: input.limit ?? AI_SEARCH_CREATORS_PAGE_SIZE,
    page: 1,
  };
}
