import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { detectBrandFromProfile } from "@/features/campaign-intelligence-profile/services/match-brand-from-profile";
import { normalizeCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/services/normalize-profile";
import {
  getCampaignIntelligenceProfileById,
  getCampaignIntelligenceProfileForConversation,
} from "@/features/campaign-intelligence-profile/services/profile-repository";
import {
  elevatedCreateCampaignIntelligenceProfile,
  elevatedUpdateCampaignIntelligenceProfile,
} from "@/features/campaign-intelligence-profile/services/profile-repository-elevated";

import {
  reanalyzeBriefIntelligence,
  type CampaignIntelligenceProfileStore,
  type ReanalyzedBriefIntelligence,
} from "./reanalyze-campaign-brief";

export type { ReanalyzedBriefIntelligence } from "./reanalyze-campaign-brief";

/** The real store — existing repository primitives, no new persistence path. */
function campaignIntelligenceProfileStore(
  supabase: SupabaseClient,
  userId: string
): CampaignIntelligenceProfileStore {
  return {
    async getForConversation(conversationId) {
      const row = await getCampaignIntelligenceProfileForConversation(supabase, conversationId);
      if (!row) return null;
      return {
        id: row.id,
        profile: normalizeCampaignIntelligenceProfile(row.profile),
        title: row.title,
      };
    },

    async update({ profileId, profile, title }) {
      await elevatedUpdateCampaignIntelligenceProfile(supabase, profileId, {
        userId,
        profile,
        status: "saved",
        title,
      });
      const refreshed = await getCampaignIntelligenceProfileById(supabase, profileId);
      return refreshed ? normalizeCampaignIntelligenceProfile(refreshed.profile) : profile;
    },

    async create({ conversationId, profile, title }) {
      // Existing allowMissingBrand path — a brand absent from the CRM catalog
      // must never block Intake.
      const brandDetection = await detectBrandFromProfile(supabase, profile);
      const row = await elevatedCreateCampaignIntelligenceProfile(supabase, {
        userId,
        conversationId,
        brandId: brandDetection.bestMatch?.brandId ?? null,
        allowMissingBrand: true,
        title,
        profile,
      });
      await elevatedUpdateCampaignIntelligenceProfile(supabase, row.id, {
        userId,
        profile,
        status: "saved",
        conversationId,
        title,
      });
      return { id: row.id, profile };
    },
  };
}

/**
 * Re-analyze an edited campaign brief and persist it as the canonical profile
 * for the conversation. Thin adapter — all decisions live in
 * `reanalyzeBriefIntelligence`, which runs the pipeline exactly once.
 */
export async function reanalyzeAndPersistBriefIntelligence(input: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  briefText: string;
  /** Campaign Object facts — the second canonical record of operator provenance. */
  previousFacts?: CampaignFacts | null;
}): Promise<ReanalyzedBriefIntelligence | null> {
  return reanalyzeBriefIntelligence(
    campaignIntelligenceProfileStore(input.supabase, input.userId),
    {
      conversationId: input.conversationId,
      briefText: input.briefText,
      previousFacts: input.previousFacts,
    }
  );
}
