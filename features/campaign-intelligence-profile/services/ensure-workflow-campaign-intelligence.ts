import type { SupabaseClient } from "@supabase/supabase-js";

import { hasValidatedIntelligence } from "./get-validated-intelligence";
import { detectBrandFromProfile } from "./match-brand-from-profile";
import { normalizeCampaignIntelligenceProfile } from "./normalize-profile";
import type {
  CampaignIntelligenceProfile,
  CampaignIntelligenceProfileRow,
} from "../types/profile";
import {
  findSavedCampaignIntelligenceProfileForWorkflow,
  getCampaignIntelligenceProfileById,
  getWorkflowCampaignIntelligenceProfileForConversation,
} from "./profile-repository";
import {
  elevatedCreateCampaignIntelligenceProfile,
  elevatedUpdateCampaignIntelligenceProfile,
} from "./profile-repository-elevated";
import {
  profileAlreadyExtractedFromBrief,
  resolveBriefTextForExtraction,
  resolveStructuredDocumentForBriefText,
} from "./resolve-brief-text";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";
import type { StructuredBriefDocument } from "./structured-brief-parser/types";

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

type EnsureBriefText = {
  text: string;
  /**
   * The structured document the text came from, when it came from one.
   *
   * Deliberately paired with the winning text source rather than fetched
   * independently: deliverables, KPIs, key message and CTA are read from a
   * document's own heading + list sections, so handing the pipeline a document
   * that did not produce `text` would import another brief's fields. A typed
   * brief has no document and gets none.
   */
  structuredDocument?: StructuredBriefDocument;
};

async function resolveBriefTextForEnsure(
  supabase: SupabaseClient,
  profileId: string,
  fallback: string
): Promise<EnsureBriefText> {
  const row = await getCampaignIntelligenceProfileById(supabase, profileId);
  if (!row) return { text: fallback };

  const profile = normalizeCampaignIntelligenceProfile(row.profile);
  const docRow = await supabase
    .from("campaign_intelligence_documents")
    .select("parsed_text, llm_brief_text, structured_document")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const documentRow =
    !docRow.error && docRow.data
      ? (docRow.data as {
          parsed_text?: string | null;
          llm_brief_text?: string | null;
          structured_document?: StructuredBriefDocument | null;
        })
      : null;

  const resolved = documentRow
    ? resolveBriefTextForExtraction({ profile, document: documentRow })
    : null;
  const fromDoc = resolved?.text.trim() ?? "";

  if (fromDoc.length >= MIN_BRIEF_CHARS && resolved) {
    return {
      text: fromDoc,
      structuredDocument: resolveStructuredDocumentForBriefText({
        source: resolved.source,
        profileDocument: profile.structuredBrief?.document,
        storedDocument: documentRow?.structured_document,
      }),
    };
  }

  const excerpt = profile.rawBriefExcerpt?.trim() ?? "";
  if (excerpt.length >= MIN_BRIEF_CHARS) return { text: excerpt };

  return { text: fallback };
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
  let existingProfile: CampaignIntelligenceProfile | null = null;
  if (input.existingProfileId) {
    const existing = await getCampaignIntelligenceProfileById(
      supabase,
      input.existingProfileId
    );
    if (existing) {
      existingProfile = normalizeCampaignIntelligenceProfile(existing.profile);
      if (hasValidatedIntelligence(existingProfile)) {
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
  // Carried alongside the text so the workflow arm runs the SAME extraction the
  // direct upload path does. Without it `applyStructuredBriefFields` had no
  // document to read, and a brief whose deliverables/KPIs/key message/CTA live
  // in heading + list sections lost all four here while the upload path kept
  // them — the two entry paths disagreed on the same document.
  let structuredParserOutput: StructuredBriefDocument | undefined;
  if (briefText.length < MIN_BRIEF_CHARS && input.existingProfileId) {
    const resolvedBrief = await resolveBriefTextForEnsure(
      supabase,
      input.existingProfileId,
      briefText
    );
    briefText = resolvedBrief.text;
    structuredParserOutput = resolvedBrief.structuredDocument;
  }

  if (briefText.length < MIN_BRIEF_CHARS) {
    return undefined;
  }

  // `create-campaign` calls this twice: once at bootstrap and again before
  // search-creators, because a brief too short to profile at bootstrap may
  // become profilable later. When bootstrap already built this conversation's
  // profile from this exact text and it did not clear the validated-intelligence
  // gate, the second call used to extract the identical text again — a second
  // LLM round-trip that, extraction being deterministic, can only produce the
  // same unvalidated profile, and then persisted it as a duplicate row for the
  // same conversation. Reuse the row instead.
  //
  // Placed after resolveWorkflowCampaignIntelligenceProfile deliberately: the
  // second call carries brand hints the first did not, and attaching a saved
  // library brief with real validated intelligence is still preferred over
  // reusing an unvalidated row. Only the provably repeated extraction is skipped.
  if (
    input.existingProfileId &&
    existingProfile &&
    profileAlreadyExtractedFromBrief({
      rawBriefExcerpt: existingProfile.rawBriefExcerpt,
      briefText,
    })
  ) {
    return input.existingProfileId;
  }

  const { profile: extracted } = await runCampaignIntelligencePipeline({
    briefText,
    briefTextSource: "upload",
    // Undefined for a typed brief: there is no document, and the pipeline then
    // behaves exactly as before.
    structuredParserOutput,
  });

  const persistable =
    hasValidatedIntelligence(extracted) ||
    Boolean(
      extracted.brandName?.trim() ||
        extracted.campaignName?.trim() ||
        extracted.objective?.trim() ||
        extracted.clientName?.trim()
    );

  if (!persistable) {
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
