/**
 * Conflict resolution for Creator DNA field candidates.
 * Source priority: manual > campaign > oauth > ipl > ai_infer
 * Confidence-weighted — not newest-wins always.
 */

import { DNA_SOURCE_PRIORITY, type DnaFieldCandidate, type DnaSource, type FieldEnvelope } from "../types";
import { applyEnvelopeUpdate, createEmptyEnvelope } from "./field-envelope";

const PRIORITY_WEIGHT = 0.55;
const CONFIDENCE_WEIGHT = 0.45;

export function sourcePriority(source: DnaSource): number {
  return DNA_SOURCE_PRIORITY[source] ?? 0;
}

export function compositeScore(candidate: {
  source: DnaSource;
  confidence: number;
}): number {
  const normalizedPriority = sourcePriority(candidate.source) / 5;
  return normalizedPriority * PRIORITY_WEIGHT + candidate.confidence * CONFIDENCE_WEIGHT;
}

export function resolveConflicts<T>(
  current: FieldEnvelope<T> | undefined,
  candidates: DnaFieldCandidate<T>[]
): FieldEnvelope<T> {
  if (candidates.length === 0) {
    return current ?? createEmptyEnvelope(null as T);
  }

  const allCandidates: DnaFieldCandidate<T>[] = current
    ? [
        {
          path: "",
          value: current.value,
          confidence: current.confidence,
          source: current.source,
          sourceVersion: current.sourceVersion,
          updatedAt: current.updatedAt,
        },
        ...candidates,
      ]
    : candidates;

  let winner = allCandidates[0]!;
  let winnerScore = compositeScore(winner);

  for (let i = 1; i < allCandidates.length; i++) {
    const candidate = allCandidates[i]!;
    const score = compositeScore(candidate);
    if (score > winnerScore) {
      winner = candidate;
      winnerScore = score;
    } else if (score === winnerScore) {
      const winnerTime = new Date(winner.updatedAt).getTime();
      const candidateTime = new Date(candidate.updatedAt).getTime();
      if (candidateTime > winnerTime) {
        winner = candidate;
      }
    }
  }

  const base: FieldEnvelope<T> = {
    value: winner.value,
    confidence: winner.confidence,
    source: winner.source,
    sourceVersion: winner.sourceVersion ?? null,
    updatedAt: winner.updatedAt,
    history: current?.history ?? [],
  };

  const latestCandidate = candidates[candidates.length - 1] ?? winner;
  return applyEnvelopeUpdate(current, latestCandidate, base);
}

export function calculateConfidenceForCandidate<T>(
  candidate: DnaFieldCandidate<T>
): number {
  return candidate.confidence;
}
