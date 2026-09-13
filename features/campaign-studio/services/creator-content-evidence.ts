import type { SupabaseClient } from "@supabase/supabase-js";

import { CreatorDNAService } from "@/features/creator-dna/services/creator-dna-service";
import type { CreatorDNARecord, DnaSource, FieldEnvelope } from "@/features/creator-dna/types";
import type {
  CreatorContentEvidenceRef,
  CreatorContentProvenance,
} from "@/features/campaign-intelligence/types/section-schemas";

/**
 * DTO deliberately constrained to Content planning. It is derived from Creator
 * DNA at read time and never becomes a campaign-level source of truth.
 */
export type CreatorContentEvidence = {
  creatorId: string;
  platform?: string;
  categories: string[];
  interests: string[];
  languages: string[];
  geography?: string;
  recentPublications: Array<{ id: string; publishedAt?: string; caption?: string; provenance: CreatorContentProvenance }>;
  evidenceRefs: CreatorContentEvidenceRef[];
  freshness?: string;
};

export type CreatorContentEvidenceByCreatorId = Record<string, CreatorContentEvidence>;

function bareId(creatorId: string): string {
  return creatorId.trim().replace(/^(inf|dis):/, "");
}

function provenance(source: DnaSource | undefined): CreatorContentProvenance {
  return source === "ai_infer" ? "DERIVED" : "OBSERVED";
}

function strings(envelope: FieldEnvelope<string[]> | undefined): string[] {
  return (envelope?.value ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 4);
}

function text(envelope: FieldEnvelope<string | null> | undefined): string | undefined {
  return envelope?.value?.trim() || undefined;
}

function addRef(
  refs: CreatorContentEvidenceRef[],
  id: string,
  label: string,
  envelope: FieldEnvelope<unknown> | undefined,
  freshness?: string
) {
  if (!envelope?.value) return;
  refs.push({ id, label, provenance: provenance(envelope.source), freshness });
}

/** Pure projection from one canonical DNA record into the Content DTO. */
export function projectCreatorContentEvidence(record: CreatorDNARecord): CreatorContentEvidence {
  const { document } = record;
  const freshness = document.meta.lastIntelligenceUpdate ?? record.updatedAt;
  const refs: CreatorContentEvidenceRef[] = [];
  addRef(refs, "dna:platform", "Canonical platform identity", document.platforms.primaryPlatform, freshness);
  addRef(refs, "dna:categories", "Creator category signals", document.audience.categories, freshness);
  addRef(refs, "dna:interests", "Creator audience interests", document.audience.interests, freshness);
  addRef(refs, "dna:languages", "Creator languages", document.audience.languages, freshness);
  addRef(refs, "dna:country", "Creator geography", document.audience.country, freshness);
  addRef(refs, "dna:recent-publications", "Recent publication evidence", document.content.recentPublications, freshness);

  const publicationProvenance = provenance(document.content.recentPublications.source);
  const recentPublications = (document.content.recentPublications.value ?? [])
    .slice(0, 3)
    .map((publication, index) => ({
      id: `dna:publication:${index + 1}`,
      ...(publication.posted_at ? { publishedAt: publication.posted_at } : {}),
      // A short caption is retained as inspectable evidence, never converted to
      // a claim about recurring style or audience response.
      ...(publication.caption?.trim() ? { caption: publication.caption.trim().slice(0, 180) } : {}),
      provenance: publicationProvenance,
    }));

  return {
    creatorId: record.influencerId,
    platform: text(document.platforms.primaryPlatform) ?? text(document.identity.platform),
    categories: strings(document.audience.categories),
    interests: strings(document.audience.interests),
    languages: strings(document.audience.languages),
    geography: text(document.audience.country),
    recentPublications,
    evidenceRefs: refs,
    ...(freshness ? { freshness } : {}),
  };
}

/**
 * One bounded batch read for the active slate. Missing DNA is a supported
 * sparse-evidence state, not an error and never triggers a per-creator lookup.
 */
export async function loadCreatorContentEvidence(
  supabase: SupabaseClient,
  creatorIds: string[]
): Promise<CreatorContentEvidenceByCreatorId> {
  const ids = [...new Set(creatorIds.map(bareId).filter(Boolean))];
  if (ids.length === 0) return {};

  const records = await new CreatorDNAService(supabase).getCreatorDNABatch(ids);
  const result: CreatorContentEvidenceByCreatorId = {};
  for (const [id, record] of records) result[id] = projectCreatorContentEvidence(record);
  return result;
}

export function evidenceForCreator(
  evidence: CreatorContentEvidenceByCreatorId | undefined,
  creatorId: string
): CreatorContentEvidence | undefined {
  return evidence?.[creatorId] ?? evidence?.[bareId(creatorId)];
}
