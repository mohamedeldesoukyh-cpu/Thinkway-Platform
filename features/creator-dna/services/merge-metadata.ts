/**
 * Applies intelligence metadata on every mergeEvidence() write.
 */

import type {
  CreatorDNADocument,
  CreatorDnaLifecycle,
  DnaIntelligenceSource,
} from "../types";
import {
  appendIntelligenceSource,
  resolveLifecycleAfterMerge,
} from "./dna-lifecycle";

export type MergeMetadataInput = {
  document: CreatorDNADocument;
  mergedAt: string;
  intelligenceSource: DnaIntelligenceSource | null;
  intelligenceFieldsChanged: boolean;
  lifecycleContext: {
    influencerStatus: string;
    isImport: boolean;
    hasCampaignHistory: boolean;
    hasEnrichmentSnapshot: boolean;
  };
};

export type MergeMetadataResult = {
  document: CreatorDNADocument;
  lifecycle: CreatorDnaLifecycle;
  lastIntelligenceUpdate: string | null;
};

export function applyMergeMetadata(input: MergeMetadataInput): MergeMetadataResult {
  const { document, mergedAt, intelligenceSource, intelligenceFieldsChanged } = input;
  const previousIntelligenceUpdate = document.meta.lastIntelligenceUpdate;

  const sources = appendIntelligenceSource(document.meta.sources, intelligenceSource);
  const lifecycle = resolveLifecycleAfterMerge({
    current: document.meta.lifecycle,
    mergeSource: intelligenceSource,
    influencerStatus: input.lifecycleContext.influencerStatus,
    isImport: input.lifecycleContext.isImport,
    hasCampaignHistory: input.lifecycleContext.hasCampaignHistory,
    hasEnrichmentSnapshot: input.lifecycleContext.hasEnrichmentSnapshot,
  });

  const lastIntelligenceUpdate = intelligenceFieldsChanged
    ? mergedAt
    : previousIntelligenceUpdate;

  const nextMeta = {
    ...document.meta,
    sources,
    lastMergeSource: intelligenceSource ?? document.meta.lastMergeSource,
    lastMergeDate: intelligenceSource ? mergedAt : document.meta.lastMergeDate,
    lastMergedAt: intelligenceSource ? mergedAt : document.meta.lastMergedAt,
    lastIntelligenceUpdate,
    lifecycle,
  };

  return {
    document: { ...document, meta: nextMeta },
    lifecycle,
    lastIntelligenceUpdate,
  };
}
