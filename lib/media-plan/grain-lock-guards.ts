/**
 * Release 2.1 — integrity guards for Media Plan schedule mutations.
 * Protects Assignment grains that are live, locked, or billing-locked.
 * Does not invent a new lock product — reads existing Assignment hierarchy facts.
 */

import type { MediaPlanPerformanceFact } from "./types";

export type GrainLockGuardInput = {
  /** Creator ids being moved (display identity). */
  creatorIds?: string[];
  /** Optional Assignment ids when the UI/slate already knows them. */
  campaignLineIds?: string[];
};

export type GrainLockGuardResult =
  | { ok: true }
  | { ok: false; message: string };

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Reject schedule moves that target Assignment grains already live or billing-locked.
 * Commercial lock (`isLocked`) alone must not block unpublished Remaining reschedule —
 * campaigns under Client IO / commercial freeze still need to move not-live cards.
 */
export function assertScheduleMoveAllowedByAssignmentGrain(
  facts: MediaPlanPerformanceFact[],
  input: GrainLockGuardInput
): GrainLockGuardResult {
  if (!facts.length) return { ok: true };

  const creatorIds = new Set((input.creatorIds ?? []).map(norm).filter(Boolean));
  const lineIds = new Set((input.campaignLineIds ?? []).map(norm).filter(Boolean));
  if (!creatorIds.size && !lineIds.size) return { ok: true };

  const blocked = facts.filter((fact) => {
    const matchesLine =
      Boolean(fact.campaignLineId?.trim()) && lineIds.has(norm(fact.campaignLineId));
    const matchesCreator =
      Boolean(fact.creatorId?.trim()) && creatorIds.has(norm(fact.creatorId));
    if (!matchesLine && !matchesCreator) return false;

    if (fact.billingLocked) return true;
    if (fact.completed && fact.liveDate) return true;
    return false;
  });

  if (!blocked.length) return { ok: true };

  const sample = blocked[0]!;
  const label =
    sample.creatorName?.trim() ||
    sample.creatorId ||
    sample.campaignLineId ||
    "Assignment";

  if (sample.billingLocked) {
    return {
      ok: false,
      message: `Cannot reschedule ${label}: this Assignment grain is billing-locked.`,
    };
  }

  return {
    ok: false,
    message: `Cannot reschedule ${label}: live Performance date is already recorded (${sample.liveDate}).`,
  };
}
