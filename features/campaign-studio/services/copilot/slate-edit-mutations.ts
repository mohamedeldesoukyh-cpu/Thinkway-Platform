import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftChange,
  StudioDraftCreatorRef,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import { normalizeCreatorId } from "../studio-draft";
import { tierFollowerRange } from "./slate-edit-filters";

/** Normalized ids currently on the slate — so additions never duplicate. */
export function slateCreatorIdSet(campaignObject: CampaignObject): Set<string> {
  const data = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  return new Set((data.recommendations?.creatorIds ?? []).map(normalizeCreatorId));
}

/** Hydrate the current slate as raw creator records (location, engagement, etc.). */
export async function hydrateSlateCreators(
  supabase: SupabaseClient,
  campaignObject: CampaignObject
): Promise<UnifiedCreatorResult[]> {
  const data = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const influencerIds = [
    ...new Set(
      (data.recommendations?.creatorIds ?? [])
        .map((id) => id.trim())
        .filter((id) => Boolean(id) && !id.startsWith("dp:") && !id.startsWith("dis:"))
        .map(normalizeCreatorId)
    ),
  ];
  if (influencerIds.length === 0) return [];
  try {
    const result = await browseUnifiedCreators(
      supabase,
      { influencerIds, page: 1, pageSize: influencerIds.length, productionOnly: true },
      "discovery"
    );
    return result.creators;
  } catch {
    return [];
  }
}

export type CreatorSearchParams = {
  category?: string;
  tier?: string;
  city?: string;
  country?: string;
  /** Falls back to the campaign's primary platform. */
  platform?: string;
  limit?: number;
};

/** Search Discovery for creators to add, scoped to the campaign's platform by default. */
export async function searchCreatorsForAddition(
  supabase: SupabaseClient,
  campaignObject: CampaignObject,
  params: CreatorSearchParams
): Promise<UnifiedCreatorResult[]> {
  const facts = getCampaignFacts(campaignObject);
  const platform = params.platform?.trim() || facts?.platforms?.[0];
  const country = params.country?.trim() || facts?.geography?.[0];
  const range = params.tier ? tierFollowerRange(params.tier) : {};
  const limit = Math.min(Math.max(params.limit ?? 3, 1), 12);

  try {
    const result = await browseUnifiedCreators(
      supabase,
      {
        category: params.category?.trim() || undefined,
        city: params.city?.trim() || undefined,
        country: country || undefined,
        platform: platform || undefined,
        minFollowers: range.minFollowers,
        maxFollowers: range.maxFollowers,
        productionOnly: true,
        page: 1,
        // Over-fetch so slate exclusion still leaves enough candidates.
        pageSize: limit + 12,
      },
      "discovery"
    );
    return result.creators;
  } catch {
    return [];
  }
}

/** Build a draft add ref from a hydrated creator (Discovery source — manual enrichment). */
export function creatorToDraftRef(creator: UnifiedCreatorResult): StudioDraftCreatorRef {
  const primary = creator.platforms?.[0];
  return {
    creatorId: creator.unified_id,
    displayName: creator.display_name,
    handle: primary?.handle,
    platform: primary?.platform,
    followers: creator.metrics?.followers?.value ?? undefined,
    avatarUrl: creator.primaryAvatarUrl ?? creator.profile_image_url ?? undefined,
    source: "discovery",
    enrichmentStatus: "not_requested",
  };
}

export function buildAdditionChanges(creators: UnifiedCreatorResult[]): StudioDraftChange[] {
  const stagedAt = new Date().toISOString();
  return creators.map((creator) => ({
    kind: "add_creator" as const,
    creator: creatorToDraftRef(creator),
    stagedAt,
  }));
}

export function buildRemovalChanges(
  creators: UnifiedCreatorResult[]
): StudioDraftChange[] {
  const stagedAt = new Date().toISOString();
  return creators.map((creator) => ({
    kind: "remove_creator" as const,
    creatorId: creator.unified_id,
    displayName: creator.display_name,
    stagedAt,
  }));
}
