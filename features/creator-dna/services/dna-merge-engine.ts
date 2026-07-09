/**
 * DNA merge engine — Verified > Imported > Inferred > Empty.
 * Never overwrite verified values with inferred; preserve stronger field confidence.
 */

import {
  DNA_SOURCE_TIER,
  DNA_TIER_PRIORITY,
  type CreatorDNADocument,
  type DnaFieldCandidate,
  type DnaMergeTier,
  type DnaSource,
  type FieldEnvelope,
} from "../types";
import { resolveConflicts } from "./conflict-resolver";
import {
  applyEnvelopeUpdate,
  createEmptyEnvelope,
  envelopeHasValue,
  getNestedEnvelope,
  setNestedEnvelope,
} from "./field-envelope";

export function sourceToMergeTier(source: DnaSource, hasValue: boolean): DnaMergeTier {
  if (!hasValue) return "empty";
  return DNA_SOURCE_TIER[source] ?? "inferred";
}

export function mergeTierPriority(tier: DnaMergeTier): number {
  return DNA_TIER_PRIORITY[tier];
}

/**
 * Merge a single field candidate onto the current envelope.
 * Downgrade prevention: verified > imported > inferred > empty.
 */
export function mergeFieldCandidate<T>(
  current: FieldEnvelope<T> | undefined,
  incoming: DnaFieldCandidate<T>
): FieldEnvelope<T> {
  const incomingEnvelope: FieldEnvelope<T> = {
    value: incoming.value,
    confidence: incoming.confidence,
    source: incoming.source,
    sourceVersion: incoming.sourceVersion ?? null,
    updatedAt: incoming.updatedAt,
    history: [],
  };

  const incomingHasValue = envelopeHasValue(incomingEnvelope);
  if (!incomingHasValue) {
    return current ?? createEmptyEnvelope(incoming.value);
  }

  const currentHasValue = envelopeHasValue(current);
  if (!currentHasValue) {
    return resolveConflicts(current, [incoming]);
  }

  const currentTier = sourceToMergeTier(current!.source, true);
  const incomingTier = sourceToMergeTier(incoming.source, true);

  if (mergeTierPriority(currentTier) > mergeTierPriority(incomingTier)) {
    return applyEnvelopeUpdate(current, incoming, current!);
  }

  if (
    mergeTierPriority(currentTier) === mergeTierPriority(incomingTier) &&
    current!.confidence > incoming.confidence &&
    envelopeHasValue(current)
  ) {
    return applyEnvelopeUpdate(current, incoming, current!);
  }

  return resolveConflicts(current, [incoming]);
}

export type MergeCandidatesResult = {
  changedFields: string[];
  fieldConfidences: Record<string, number>;
};

/** Merge multiple candidates into a DNA document (in-memory). */
export function mergeCandidatesIntoDocument(
  document: CreatorDNADocument,
  candidates: DnaFieldCandidate<unknown>[]
): MergeCandidatesResult {
  const changedFields: string[] = [];
  const fieldConfidences: Record<string, number> = {};
  const docRecord = document as unknown as Record<string, unknown>;

  for (const candidate of candidates) {
    const current = getNestedEnvelope(docRecord, candidate.path) as
      | FieldEnvelope<unknown>
      | undefined;
    const prevJson = JSON.stringify(current?.value ?? null);
    const resolved = mergeFieldCandidate(current, candidate);
    const nextJson = JSON.stringify(resolved.value ?? null);

    setNestedEnvelope(docRecord, candidate.path, resolved);
    fieldConfidences[candidate.path] = resolved.confidence;

    if (prevJson !== nextJson || current?.source !== resolved.source) {
      changedFields.push(candidate.path);
    }
  }

  return { changedFields, fieldConfidences };
}

/** Normalize → merge → update DNA document preserving stronger values. */
export function mergeNormalizedCandidates(
  document: CreatorDNADocument,
  candidates: DnaFieldCandidate<unknown>[]
): CreatorDNADocument {
  mergeCandidatesIntoDocument(document, candidates);
  document.meta.lastMergedAt = new Date().toISOString();
  return document;
}
