import type { SupabaseClient } from "@supabase/supabase-js";

import { hasValidatedIntelligence } from "./get-validated-intelligence";
import { detectBrandFromProfile } from "./match-brand-from-profile";
import { normalizeCampaignIntelligenceProfile } from "./normalize-profile";
import type { CampaignIntelligenceProfileRow } from "../types/profile";
import {
  findSavedCampaignIntelligenceProfileForWorkflow,
  getCampaignIntelligenceProfileById,
  getWorkflowCampaignIntelligenceProfileForConversation,
} from "./profile-repository";
import {
  elevatedCreateCampaignIntelligenceProfile,
  elevatedUpdateCampaignIntelligenceProfile,
} from "./profile-repository-elevated";
import { resolveBriefTextForExtraction } from "./resolve-brief-text";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";

const MIN_BRIEF_CHARS = 80;

/**
 * Resolve a searchable CIP for a Studio conversation.
 * Prefers a profile already linked to the conversation; otherwise attaches the latest
 * saved library brief (matching brand when possible).
 */
export async function resolveWorkflowCampaignIntelligenceProfile(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    userId: string;
    brandId?: string | null;
    brandName?: string | null;
  }
): Promise<CampaignIntelligenceProfileRow | null> {
  const linked = await getWorkflowCampaignIntelligenceProfileForConversation(
    supabase,
    input.conversationId
  );
  if (linked) {
    const profile = normalizeCampaignIntelligenceProfile(linked.profile);
    if (hasValidatedIntelligence(profile)) {
      return linked;
    }
  }

  const saved = await findSavedCampaignIntelligenceProfileForWorkflow(
    supabase,
    input.userId,
    { brandId: input.brandId, brandName: input.brandName }
  );
  if (!saved) return null;

  const profile = normalizeCampaignIntelligenceProfile(saved.profile);
  if (!hasValidatedIntelligence(profile)) return null;

  let brandId =
    saved.brand_id?.trim() ||
    input.brandId?.trim() ||
    null;
  if (!brandId) {
    const brandDetection = await detectBrandFromProfile(supabase, profile);
    brandId = brandDetection.bestMatch?.brandId ?? null;
  }

  await elevatedUpdateCampaignIntelligenceProfile(supabase, saved.id, {
    userId: input.userId,
    profile,
    conversationId: input.conversationId,
    ...(brandId ? { brandId } : {}),
  });

  return {
    ...saved,
    conversation_id: input.conversationId,
    brand_id: brandId ?? saved.brand_id,
  };
}

async function resolveBriefTextForEnsure(
  supabase: SupabaseClient,
  profileId: string,
  fallback: string
): Promise<string> {
  const row = await getCampaignIntelligenceProfileById(supabase, profileId);
  if (!row) return fallback;

  const profile = normalizeCampaignIntelligenceProfile(row.profile);
  const docRow = await supabase
    .from("campaign_intelligence_documents")
    .select("parsed_text, llm_brief_text")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fromDoc =
    !docRow.error && docRow.data
      ? resolveBriefTextForExtraction({
          profile,
          document: docRow.data as {
            parsed_text?: string | null;
            llm_brief_text?: string | null;
          },
        }).text.trim()
      : "";

  if (fromDoc.length >= MIN_BRIEF_CHARS) return fromDoc;

  const excerpt = profile.rawBriefExcerpt?.trim() ?? "";
  if (excerpt.length >= MIN_BRIEF_CHARS) return excerpt;

  return fallback;
}

/**
 * Ensure a conversation has a searchable CIP before Studio creator discovery.
 * Reuses an existing linked profile; otherwise runs the same brief pipeline as Discovery Search.
 */
export async function ensureWorkflowCampaignIntelligenceProfile(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    userId: string;
    briefText: string;
    existingProfileId?: string;
    brandId?: string | null;
    brandName?: string | null;
  }
): Promise<string | undefined> {
  if (input.existingProfileId) {
    const existing = await getCampaignIntelligenceProfileById(
      supabase,
      input.existingProfileId
    );
    if (existing) {
      const profile = normalizeCampaignIntelligenceProfile(existing.profile);
      if (hasValidatedIntelligence(profile)) {
        return existing.id;
      }
    }
  }

  const resolved = await resolveWorkflowCampaignIntelligenceProfile(supabase, {
    conversationId: input.conversationId,
    userId: input.userId,
    brandId: input.brandId,
    brandName: input.brandName,
  });
  if (resolved) {
    return resolved.id;
  }

  let briefText = input.briefText.trim();
  if (briefText.length < MIN_BRIEF_CHARS && input.existingProfileId) {
    briefText = await resolveBriefTextForEnsure(
      supabase,
      input.existingProfileId,
      briefText
    );
  }

  if (briefText.length < MIN_BRIEF_CHARS) {
    return undefined;
  }

  const { profile: extracted } = await runCampaignIntelligencePipeline({
    briefText,
    briefTextSource: "upload",
  });

  if (!hasValidatedIntelligence(extracted)) {
    return undefined;
  }

  const savedProfile = {
    ...extracted,
    schemaVersion: 1 as const,
    status: "saved" as const,
    rawBriefExcerpt: briefText.slice(0, 500),
  };

  const brandDetection = await detectBrandFromProfile(supabase, savedProfile);
  const brandId = brandDetection.bestMatch?.brandId ?? null;

  // Brand catalog match is preferred for hierarchy linking, but must not gate
  // discovery. Unmatched demo brands (L'Oréal, Noon, Trendyol, …) still need a
  // searchable CIP so CIP dual-pool + enterprise constraints can run.
  const row = await elevatedCreateCampaignIntelligenceProfile(supabase, {
    userId: input.userId,
    conversationId: input.conversationId,
    brandId,
    allowMissingBrand: true,
    title: savedProfile.campaignName ?? savedProfile.brandName ?? "Campaign brief",
    profile: savedProfile,
  });

  await elevatedUpdateCampaignIntelligenceProfile(supabase, row.id, {
    userId: input.userId,
    profile: savedProfile,
    status: "saved",
    conversationId: input.conversationId,
    brandId,
    title: savedProfile.campaignName ?? savedProfile.brandName ?? undefined,
  });

  return row.id;
}
