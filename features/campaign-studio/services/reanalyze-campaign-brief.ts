import type {
  CampaignFacts,
  CampaignFactsField,
} from "@/features/campaign-director/facts/campaign-facts-types";
import { runCampaignIntelligencePipeline } from "@/features/campaign-intelligence-profile/services/run-intelligence-pipeline";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";

/**
 * Re-analysis merge for Edit Brief → Save.
 *
 * Saving an edited brief re-runs the canonical intelligence pipeline, so every
 * brief-derived field is rebuilt from the new text. Operator-entered values are
 * the exception: they outrank the brief and must survive a re-analysis that no
 * longer mentions them.
 *
 *   operator > brief > inferred > default
 *
 * Provenance is the existing `CampaignFactsSource` mechanism — Intake stamps
 * `sources[field] = "operator"` (studio-intake-facts.withOperatorSources), and
 * that stamp is the whole record. No second provenance system.
 */

/** Profile properties that carry a given fact, mirroring applyIntakeEditToProfile. */
const PROFILE_KEYS_BY_FACT: Partial<Record<CampaignFactsField, readonly string[]>> = {
  clientName: ["clientName"],
  brandName: ["brandName"],
  industry: ["industry"],
  campaignType: ["campaignType"],
  product: ["campaignName", "products"],
  objective: ["objective", "objectives"],
  budget: ["budget"],
  durationWeeks: ["durationWeeks"],
  campaignStartDate: ["campaignStartDate", "requestedStartDate", "scheduledStartDate"],
  campaignEndDate: ["campaignEndDate"],
  geography: ["geography", "market"],
  audience: ["audience", "audienceDetail"],
  platforms: ["platforms"],
  kpis: ["kpis"],
  deliverables: ["deliverables"],
  constraints: ["constraints"],
  risks: ["risks"],
  creatorCategories: ["creatorCategories"],
  keyMessage: ["keyMessage"],
  callToAction: ["callToAction"],
  campaignFunnel: ["campaignFunnel"],
  toneOfVoice: ["toneOfVoice"],
  contentFormats: ["contentStyle"],
};

type SourceBag = CampaignFacts["sources"] | undefined;

function operatorFieldsFrom(sources: SourceBag): CampaignFactsField[] {
  if (!sources) return [];
  return (Object.keys(sources) as CampaignFactsField[]).filter(
    (field) => sources[field] === "operator"
  );
}

/**
 * Fields a human owns, from BOTH canonical records.
 *
 * Intake writes operator provenance to the CIP profile through
 * confirmStudioIntakeAction, but patchStudioIntakeFactsAction writes only the
 * Campaign Object — so neither record alone is complete. A field is
 * operator-owned when either says so.
 */
export function collectOperatorOwnedFields(
  previousProfile?: Pick<CampaignIntelligenceProfile, "sources"> | null,
  campaignFacts?: Pick<CampaignFacts, "sources"> | null
): Set<CampaignFactsField> {
  return new Set([
    ...operatorFieldsFrom(previousProfile?.sources),
    ...operatorFieldsFrom(campaignFacts?.sources),
  ]);
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Apply operator-owned values from the previous profile onto a freshly
 * re-analyzed one.
 *
 * Operator fields keep the previous value, the `operator` source and its
 * confidence. Every other field is taken from the re-analysis as-is — including
 * its absence, so a value the edited brief no longer states does not linger as
 * stale brief-derived intelligence.
 */
export function mergeOperatorOwnedValues(
  previousProfile: CampaignIntelligenceProfile | null | undefined,
  reanalyzed: CampaignIntelligenceProfile,
  operatorFields: Set<CampaignFactsField>
): CampaignIntelligenceProfile {
  if (!previousProfile || operatorFields.size === 0) return reanalyzed;

  const merged: CampaignIntelligenceProfile = { ...reanalyzed };
  const sources = { ...reanalyzed.sources };
  const confidence = { ...reanalyzed.confidence };
  const previousRecord = previousProfile as unknown as Record<string, unknown>;
  const mergedRecord = merged as unknown as Record<string, unknown>;

  for (const field of operatorFields) {
    const keys = PROFILE_KEYS_BY_FACT[field];
    if (!keys) continue;

    let restoredAny = false;
    for (const key of keys) {
      const previousValue = previousRecord[key];
      if (!hasValue(previousValue)) continue;
      mergedRecord[key] = previousValue;
      restoredAny = true;
    }
    if (!restoredAny) continue;

    sources[field] = "operator";
    confidence[field] = previousProfile.confidence?.[field] ?? 1;
  }

  merged.sources = sources;
  merged.confidence = confidence;
  return merged;
}

/** Operator-owned values from the previous profile, applied in one step. */
export function mergeReanalyzedCampaignProfile(input: {
  previousProfile?: CampaignIntelligenceProfile | null;
  previousFacts?: CampaignFacts | null;
  reanalyzed: CampaignIntelligenceProfile;
}): CampaignIntelligenceProfile {
  const operatorFields = collectOperatorOwnedFields(
    input.previousProfile,
    input.previousFacts
  );
  return mergeOperatorOwnedValues(input.previousProfile, input.reanalyzed, operatorFields);
}


/**
 * Persistence the re-analysis needs, as a port. The real implementation wraps
 * the existing profile repository (see persist-reanalyzed-brief-intelligence);
 * injecting it keeps this orchestration free of `server-only` so the create /
 * update decision is directly testable.
 */
export type CampaignIntelligenceProfileStore = {
  getForConversation: (
    conversationId: string
  ) => Promise<{ id: string; profile: CampaignIntelligenceProfile; title?: string | null } | null>;
  update: (input: {
    profileId: string;
    profile: CampaignIntelligenceProfile;
    title?: string;
  }) => Promise<CampaignIntelligenceProfile>;
  create: (input: {
    conversationId: string;
    profile: CampaignIntelligenceProfile;
    title: string;
  }) => Promise<{ id: string; profile: CampaignIntelligenceProfile }>;
};

export type ReanalyzedBriefIntelligence = {
  profileId: string;
  profile: CampaignIntelligenceProfile;
  /** True when no profile existed for the conversation and one was created. */
  created: boolean;
};

/**
 * Re-analyze an edited brief and persist it as the conversation's canonical
 * profile.
 *
 * Runs the canonical pipeline exactly once per call — the same pipeline the
 * Campaign Brief upload flow uses. An existing profile is updated in place:
 * the `campaign_intelligence_profiles_updated_at_trg` trigger bumps
 * `updated_at`, and the conversation resolver orders by `updated_at DESC`, so
 * that row stays canonical without a duplicate being written.
 */
export async function reanalyzeBriefIntelligence(
  store: CampaignIntelligenceProfileStore,
  input: {
    conversationId: string;
    briefText: string;
    previousFacts?: CampaignFacts | null;
  }
): Promise<ReanalyzedBriefIntelligence | null> {
  const briefText = input.briefText.trim();
  if (!briefText) return null;

  const existing = await store.getForConversation(input.conversationId);

  const { profile: reanalyzed } = await runCampaignIntelligencePipeline({
    briefText,
    briefTextSource: "upload",
  });

  const merged = mergeReanalyzedCampaignProfile({
    previousProfile: existing?.profile,
    previousFacts: input.previousFacts,
    reanalyzed,
  });

  const profile: CampaignIntelligenceProfile = {
    ...merged,
    schemaVersion: 1,
    status: "saved",
    rawBriefExcerpt: briefText.slice(0, 500),
    // A brief edit does not re-grant operator confirmation.
    confirmedAt: existing?.profile.confirmedAt,
  };

  const title = profile.campaignName ?? profile.brandName ?? existing?.title ?? undefined;

  if (existing) {
    const saved = await store.update({ profileId: existing.id, profile, title });
    return { profileId: existing.id, profile: saved, created: false };
  }

  const row = await store.create({
    conversationId: input.conversationId,
    profile,
    title: title ?? "Campaign brief",
  });
  return { profileId: row.id, profile: row.profile, created: true };
}
