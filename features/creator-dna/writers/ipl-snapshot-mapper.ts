/**
 * Maps ipl_snapshots.normalized_snapshot → Creator DNA field candidates.
 * Delegates to apify-to-dna-mapper — no direct Apify/provider reads.
 */

import type { NormalizedProfileSnapshot } from "@/lib/intelligence-persistence/types";
import type { RawProviderPayload } from "@/lib/intelligence-persistence/types";

import { mapApifyToFieldCandidates } from "../services/apify-to-dna-mapper";
import { calculateConfidence, calculateFieldCompleteness } from "../services/confidence-calculator";
import type { DnaFieldCandidate } from "../types";

export type SnapshotToDnaInput = {
  snapshotId: string;
  normalized: NormalizedProfileSnapshot;
  snapshotVersion: number;
  fetchedAt: string;
  platformAccountId?: string | null;
  rawSnapshot?: RawProviderPayload | null;
  avatarUrlOverride?: string | null;
};

export function mapSnapshotToFieldCandidates(
  input: SnapshotToDnaInput
): DnaFieldCandidate<unknown>[] {
  return mapApifyToFieldCandidates(input);
}

export function mapReprocessCategoriesToCandidates(input: {
  snapshotId: string;
  categories: string[];
  snapshotVersion: number;
  fetchedAt: string;
}): DnaFieldCandidate<unknown>[] {
  const completeness = calculateFieldCompleteness(input.categories);
  return [
    {
      path: "audience.categories",
      value: input.categories,
      confidence: calculateConfidence({
        source: "ai_infer",
        hasValue: completeness > 0,
        snapshotVersion: input.snapshotVersion,
        fieldCompleteness: completeness,
      }),
      source: "ai_infer",
      sourceVersion: input.snapshotVersion,
      updatedAt: input.fetchedAt,
      snapshotId: input.snapshotId,
    },
    {
      path: "audience.interests",
      value: input.categories,
      confidence: calculateConfidence({
        source: "ai_infer",
        hasValue: completeness > 0,
        snapshotVersion: input.snapshotVersion,
        fieldCompleteness: completeness,
      }),
      source: "ai_infer",
      sourceVersion: input.snapshotVersion,
      updatedAt: input.fetchedAt,
      snapshotId: input.snapshotId,
    },
  ];
}
