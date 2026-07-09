import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { createEmptyCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { normalizeFromProfile } from "@/features/campaign-intelligence-profile/services/normalization";
import { mapCampaignIntelligenceToDiscoverySearch } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";

export type StudioRecommendationFixture = {
  id: string;
  label: string;
  profile: CampaignIntelligenceProfile;
  creators: UnifiedCreatorResult[];
  expectTopPlatform?: string;
  expectTopCategory?: string;
  expectTopCountry?: string;
  minTopRelevanceScore?: number;
};

function baseCreator(
  id: string,
  overrides: Partial<UnifiedCreatorResult>
): UnifiedCreatorResult {
  return {
    unified_id: id,
    source_type: "internal",
    influencer_id: id.replace("inf:", ""),
    discovered_profile_id: null,
    document_number: null,
    display_name: overrides.display_name ?? "Creator",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: "Cairo",
    categories: ["beauty"],
    browse_category_tags: ["beauty"],
    audience_interests: ["skincare"],
    language_codes: ["ar"],
    profile_image_url: null,
    bio: "Beauty creator Egypt",
    metrics: {
      followers: { value: 80_000, confidence: "estimated" },
      engagement_rate: { value: 3.1, confidence: "estimated" },
      avg_likes: { value: 0, confidence: "estimated" },
      avg_comments: { value: 0, confidence: "estimated" },
      avg_views: { value: 0, confidence: "estimated" },
      posting_frequency_per_week: { value: 0, confidence: "estimated" },
    },
    ai_category: "Beauty",
    ai_niche: "Skincare",
    authenticity_score: 75,
    thinkway_score: 70,
    source_confidence: 0.8,
    brand_fit_score: 68,
    is_platform_verified: false,
    platforms: [
      {
        id: `${id}-ig`,
        platform: "instagram",
        handle: id.replace("inf:", ""),
        profile_url: null,
        follower_count: 80_000,
        engagement_rate: 3.1,
        audience_country: "EG",
        is_verified: false,
        profile_picture_url: null,
      },
    ],
    ...overrides,
  } as UnifiedCreatorResult;
}

function buildLorealProfile(): CampaignIntelligenceProfile {
  const raw: CampaignIntelligenceProfile = {
    ...createEmptyCampaignIntelligenceProfile(),
    brandName: "L'Oréal Paris",
    campaignName: "Vitamin C Launch",
    objectives: ["Skincare awareness in Egypt"],
    platforms: ["instagram", "tiktok"],
    market: "Egypt",
    rawBriefExcerpt: "L'Oréal Paris skincare campaign in Egypt on Instagram and TikTok",
    audienceDetail: {
      gender: "Female",
      ageMin: 25,
      ageMax: 45,
      countries: ["EG"],
    },
    creatorCategories: ["Beauty"],
    creatorNiches: ["skincare", "vitamin c"],
    sources: { geography: "brief", platforms: "brief", audience: "brief", brandName: "brief" },
    confidence: { geography: 0.9, platforms: 0.9, audience: 0.88, brandName: 0.9 },
  };
  return normalizeFromProfile(raw).profile;
}

function buildEtisalatProfile(): CampaignIntelligenceProfile {
  const raw: CampaignIntelligenceProfile = {
    ...createEmptyCampaignIntelligenceProfile(),
    brandName: "Etisalat",
    campaignName: "E& 5G Youth Launch",
    objectives: ["Drive 5G awareness among Gen Z in UAE"],
    platforms: ["tiktok", "instagram"],
    market: "United Arab Emirates",
    rawBriefExcerpt:
      "Etisalat E& telecom campaign targeting Gen Z in UAE on TikTok and Instagram — tech and lifestyle creators",
    audienceDetail: {
      gender: "any",
      ageMin: 18,
      ageMax: 28,
      countries: ["AE"],
    },
    creatorCategories: ["Technology", "Lifestyle"],
    creatorNiches: ["5g", "tech reviews", "mobile"],
    sources: { geography: "brief", platforms: "brief", audience: "brief", brandName: "brief" },
    confidence: { geography: 0.9, platforms: 0.9, audience: 0.85, brandName: 0.9 },
  };
  return normalizeFromProfile(raw).profile;
}

export const STUDIO_RECOMMENDATION_FIXTURES: StudioRecommendationFixture[] = [
  {
    id: "loreal-egypt-skincare",
    label: "L'Oréal Egypt skincare",
    profile: buildLorealProfile(),
    creators: [
      baseCreator("inf:loreal-weak", {
        display_name: "Generic US Creator",
        country_code: "US",
        categories: [],
        bio: "Travel vlogs",
        platforms: [
          {
            id: "pa-us",
            platform: "youtube",
            handle: "travel_us",
            profile_url: null,
            follower_count: 200_000,
            engagement_rate: 2,
            audience_country: "US",
            is_verified: false,
            profile_picture_url: null,
          },
        ],
      }),
      baseCreator("inf:loreal-strong", {
        display_name: "Egypt Skincare IG",
        categories: ["beauty", "skincare"],
        bio: "Egyptian skincare and vitamin c routines",
        platforms: [
          {
            id: "pa-eg",
            platform: "instagram",
            handle: "skincare_eg",
            profile_url: null,
            follower_count: 150_000,
            engagement_rate: 4.2,
            audience_country: "EG",
            is_verified: false,
            profile_picture_url: null,
          },
        ],
      }),
    ],
    expectTopPlatform: "instagram",
    expectTopCategory: "beauty",
    expectTopCountry: "EG",
    minTopRelevanceScore: 50,
  },
  {
    id: "etisalat-uae-5g",
    label: "Etisalat E& UAE 5G",
    profile: buildEtisalatProfile(),
    creators: [
      baseCreator("inf:etisalat-weak", {
        display_name: "Egypt Food Creator",
        country_code: "EG",
        categories: ["food"],
        bio: "Cairo food reviews",
        platforms: [
          {
            id: "pa-food",
            platform: "instagram",
            handle: "cairo_food",
            profile_url: null,
            follower_count: 90_000,
            engagement_rate: 3,
            audience_country: "EG",
            is_verified: false,
            profile_picture_url: null,
          },
        ],
      }),
      baseCreator("inf:etisalat-strong", {
        display_name: "UAE Tech TikTok",
        country_code: "AE",
        categories: ["technology", "lifestyle"],
        bio: "5G speed tests and mobile tech reviews UAE",
        ai_category: "Technology",
        ai_niche: "Mobile tech",
        platforms: [
          {
            id: "pa-tech",
            platform: "tiktok",
            handle: "uae_5g",
            profile_url: null,
            follower_count: 220_000,
            engagement_rate: 5.5,
            audience_country: "AE",
            is_verified: false,
            profile_picture_url: null,
          },
        ],
      }),
    ],
    expectTopPlatform: "tiktok",
    expectTopCountry: "AE",
    minTopRelevanceScore: 50,
  },
];

export function mappedFiltersForFixture(fixture: StudioRecommendationFixture) {
  return mapCampaignIntelligenceToDiscoverySearch(fixture.profile).filters;
}
