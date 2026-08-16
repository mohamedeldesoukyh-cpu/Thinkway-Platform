import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { deriveCreatorCategoriesFromBrief } from "./derive-creator-categories";
import {
  creatorFitsPreferredCategories,
  resolveStudioCreatorCategories,
} from "./studio-creator-category-fit";
import {
  vendorMatchesCampaignMarket,
  type StudioCreatorLocation,
} from "./studio-market-creators";

export type StudioRequirementScore = {
  met: number;
  total: number;
  ratio: number;
};

export type StudioRequirementHydration = {
  campaignMarkets?: string[];
  preferredPlatforms?: string[];
  campaignIndustry?: string;
  campaignType?: string;
  briefText?: string;
  objective?: string;
  audience?: string;
};

function platformMatches(platform: string | undefined, required: string[]): boolean {
  const value = platform?.trim().toLowerCase() ?? "";
  if (!value) return false;
  return required.some((item) => {
    const needle = item.trim().toLowerCase();
    if (!needle) return false;
    return value.includes(needle) || needle.includes(value);
  });
}

export function studioFactsFromHydrationOptions(
  options: StudioRequirementHydration | undefined
): CampaignFacts | undefined {
  if (!options) return undefined;
  const geography = options.campaignMarkets?.filter((value) => value.trim()) ?? [];
  const platforms = options.preferredPlatforms?.map((item) => item.trim()).filter(Boolean) ?? [];
  const industry = options.campaignIndustry?.trim();
  const campaignType = options.campaignType?.trim();
  const briefText = options.briefText?.trim();
  const objective = options.objective?.trim();
  const audience = options.audience?.trim();
  if (
    geography.length === 0 &&
    platforms.length === 0 &&
    !industry &&
    !campaignType &&
    !briefText &&
    !objective
  ) {
    return undefined;
  }
  return {
    geography: geography.length > 0 ? geography : undefined,
    platforms: platforms.length > 0 ? platforms : undefined,
    industry: industry || undefined,
    campaignType: campaignType || undefined,
    rawBriefExcerpt: briefText || undefined,
    objective: objective || undefined,
    audience: audience || undefined,
    extractedAt: "",
    confidence: {},
    sources: {},
  };
}

/** Campaign Facts the operator confirmed — never invent extra requirement rows. */
export function studioCreatorRequirementScore(
  input: StudioCreatorLocation & {
    platform?: string;
    audienceSummary?: string;
    category?: string;
    categories?: string[];
    handle?: string;
    displayName?: string;
  },
  facts: CampaignFacts | undefined
): StudioRequirementScore {
  const checks: boolean[] = [];
  const markets = facts?.geography?.filter((value) => value.trim()) ?? [];
  if (markets.length > 0) {
    checks.push(vendorMatchesCampaignMarket(input, markets));
  }
  const platforms = (facts?.platforms ?? []).map((item) => item.trim()).filter(Boolean);
  if (platforms.length > 0) {
    checks.push(platformMatches(input.platform, platforms));
  }
  const preferredCategories = deriveCreatorCategoriesFromBrief({
    briefText: facts?.rawBriefExcerpt,
    objective: facts?.objective,
    audience: facts?.audience,
    campaignName: facts?.product,
    products: facts?.product ? [facts.product] : undefined,
  });
  if (preferredCategories.length > 0) {
    checks.push(
      creatorFitsPreferredCategories(
        {
          categories: [
            ...(input.categories ?? []),
            input.category,
            input.audienceSummary,
          ],
          audienceSummary: input.audienceSummary,
          handle: input.handle,
          displayName: input.displayName,
        },
        preferredCategories
      )
    );
  }

  const total = checks.length;
  const met = checks.filter(Boolean).length;
  return {
    met,
    total,
    ratio: total > 0 ? met / total : 1,
  };
}

/** Recommended list gate: skip when the brief has no mix; otherwise require a real fit. */
export function vendorFitsStudioBriefMix(
  input: {
    audienceSummary?: string;
    category?: string;
    categories?: string[];
    handle?: string;
    displayName?: string;
  },
  facts: CampaignFacts | undefined
): boolean {
  const preferredCategories = deriveCreatorCategoriesFromBrief({
    briefText: facts?.rawBriefExcerpt,
    objective: facts?.objective,
    audience: facts?.audience,
    campaignName: facts?.product,
    products: facts?.product ? [facts.product] : undefined,
  });
  if (preferredCategories.length === 0) return true;
  const resolved = resolveStudioCreatorCategories({
    categories: [...(input.categories ?? []), input.category, input.audienceSummary],
    audienceSummary: input.audienceSummary,
    handle: input.handle,
    displayName: input.displayName,
  });
  if (resolved.length === 0) return true;
  return creatorFitsPreferredCategories(
    {
      categories: resolved,
      audienceSummary: input.audienceSummary,
      handle: input.handle,
      displayName: input.displayName,
    },
    preferredCategories
  );
}

export function compareStudioRequirementScores(
  left: StudioRequirementScore,
  right: StudioRequirementScore
): number {
  if (right.ratio !== left.ratio) return right.ratio - left.ratio;
  if (right.met !== left.met) return right.met - left.met;
  return 0;
}

export function sortByStudioRequirements<T>(
  items: T[],
  scoreOf: (item: T) => StudioRequirementScore
): T[] {
  return [...items].sort((left, right) =>
    compareStudioRequirementScores(scoreOf(left), scoreOf(right))
  );
}

export function unifiedCreatorRequirementScore(
  creator: UnifiedCreatorResult,
  facts: CampaignFacts | undefined
): StudioRequirementScore {
  return studioCreatorRequirementScore(
    {
      countryCode: creator.country_code,
      countryCodes: creator.country_codes,
      estimatedCountry: creator.estimated_country,
      audienceCountries: creator.platforms.map((platform) => platform.audience_country),
      platform: creator.platforms.map((platform) => platform.platform).join(" "),
      audienceSummary: creator.audience_interests?.slice(0, 3).join(" "),
      categories: [
        creator.ai_category,
        creator.ai_niche,
        ...(creator.categories ?? []),
        ...(creator.browse_category_tags ?? []),
      ].filter((value): value is string => Boolean(value)),
      handle: creator.platforms[0]?.handle ?? creator.display_name,
      displayName: creator.display_name,
    },
    facts
  );
}

export function studioRequirementBadgeLabel(score: StudioRequirementScore): string | null {
  if (score.total === 0) return null;
  return `Requirements ${score.met}/${score.total}`;
}
