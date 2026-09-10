/**
 * What a creator card says to a client.
 *
 * Enterprise Creator Intelligence is a decision-support layer. Its reasoning
 * was being printed onto the ordinary creator card verbatim — "Overall score 40
 * with multiple high risks", "Commercial outlook weak", "Evidence does not
 * support selection", a raw confidence percentage — which is internal analyst
 * language, not something to put in front of a client.
 *
 * Nothing here changes an ECI calculation, a score, or a gate. The signal is
 * read exactly as produced; this decides which of its already-human sentences
 * are appropriate on a card, and states the decision in the vocabulary of the
 * group the card is in.
 */

import type { StudioEciPlanningSignal } from "./eci/project-studio-eci-signal";
import { toCampaignDecisionLabel } from "./eci/strategy-confidence";
import type { StudioCreatorGroupKind } from "./studio-replacement-candidates";

/**
 * Terms that belong to the internal layer. A card must not contain these.
 * Used both to filter reason text and by the regression test.
 */
export const INTERNAL_TERMINOLOGY: readonly RegExp[] = [
  /enterprise creator intelligence/i,
  /\bECI\b/,
  /overall score\s*\d/i,
  /investment signals?/i,
  /commercial outlook/i,
  /evidence (?:does not|doesn't) support/i,
  /evidence coverage/i,
  /\bdecision layers?\b/i,
  /risk classification/i,
  /\bconfidence\s*[:=]?\s*\d+\s*%/i,
  /\bscore\s*\d+\s*\/\s*100\b/i,
];

export function containsInternalTerminology(text: string): boolean {
  return INTERNAL_TERMINOLOGY.some((pattern) => pattern.test(text));
}

/**
 * One already-written line, or nothing.
 *
 * A rationale persisted before this boundary existed can still hold analyst
 * text, and the card renders it directly. This is the last gate before the
 * screen: the line is shown as written, or it is dropped — never rewritten,
 * and never replaced by an invented sentence.
 */
export function clientSafeLine(
  text: string | null | undefined,
  fallback?: string | null
): string | null {
  const trimmed = text?.trim();
  if (trimmed && !containsInternalTerminology(trimmed)) return trimmed;
  const alternative = fallback?.trim();
  if (alternative && !containsInternalTerminology(alternative)) return alternative;
  return null;
}

/** The decision as the client reads it, in the vocabulary of its group. */
export type StudioClientDecision = {
  label: string;
  tone: "positive" | "neutral" | "negative";
  reasons: string[];
};

function sentences(value: string | undefined | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/(?:\s+—\s+|(?<=\.)\s+)/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Keep only client-appropriate lines, shortest-first, at most `limit`. */
function clientSafeReasons(candidates: string[], limit: number): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const candidate of candidates) {
    for (const line of sentences(candidate)) {
      if (line.length < 8 || line.length > 140) continue;
      if (containsInternalTerminology(line)) continue;
      const key = line.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      kept.push(line.endsWith(".") ? line : `${line}.`);
      if (kept.length >= limit) return kept;
    }
  }
  return kept;
}

/**
 * The card's decision line and reasons.
 *
 * The label depends on the GROUP, so a heading and a card can never
 * contradict each other:
 *
 *   - `selected`      → "Recommended for this campaign"
 *   - `needs_review`  → "On the slate · needs review", or "On the slate · not
 *                        recommended for this campaign" when campaign
 *                        intelligence rejects it
 *   - `alternatives`  → "Discovery alternative", or "Not recommended for this
 *                        campaign" when campaign intelligence rejects it
 *
 * A creator with NO signal is never described as rejected: absent intelligence
 * is absent, not negative.
 */
export function studioClientDecision(input: {
  group: StudioCreatorGroupKind;
  signal?: StudioEciPlanningSignal | null;
  /** Requirement rows met / total, when the card has them. */
  requirementsMet?: { met: number; total: number } | null;
  reasonLimit?: number;
}): StudioClientDecision {
  const limit = input.reasonLimit ?? 3;
  const signal = input.signal ?? null;
  const rejected = signal ? toCampaignDecisionLabel(signal.recommendation) === "Not Recommended" : false;

  const requirementLine =
    input.requirementsMet && input.requirementsMet.total > 0
      ? input.requirementsMet.met === input.requirementsMet.total
        ? "Meets every campaign requirement."
        : `Meets ${input.requirementsMet.met} of ${input.requirementsMet.total} campaign requirements.`
      : null;

  if (rejected) {
    const reasons = clientSafeReasons(
      [signal?.whyNot ?? "", ...(signal?.risks ?? []), signal?.why ?? ""],
      limit
    );
    return {
      label:
        input.group === "needs_review"
          ? "On the slate · not recommended for this campaign"
          : "Not recommended for this campaign",
      tone: "negative",
      reasons: reasons.length > 0 ? reasons : ["Campaign intelligence does not support this creator."],
    };
  }

  if (input.group === "needs_review") {
    // The gate rejects for reasons campaign intelligence knows nothing about —
    // out of market, off the brief's tier mix. Such a creator is on the slate
    // and is NOT recommended, but it is not rejected either, so it must not be
    // labelled with either verdict.
    const reasons = clientSafeReasons(
      [requirementLine ?? "", signal?.whyNot ?? ""],
      limit
    );
    return {
      label: "On the slate · needs review",
      tone: "neutral",
      reasons:
        reasons.length > 0
          ? reasons
          : ["On the campaign slate but not confirmed against the campaign's requirements."],
    };
  }

  if (input.group === "alternatives") {
    const reasons = clientSafeReasons(
      [requirementLine ?? "", ...(signal?.topStrengths ?? []), signal?.why ?? ""],
      limit
    );
    return {
      label: "Discovery alternative",
      tone: "neutral",
      reasons:
        reasons.length > 0
          ? reasons
          : ["Available from Discovery as a replacement for this campaign."],
    };
  }

  const reasons = clientSafeReasons(
    [
      requirementLine ?? "",
      ...(signal?.topStrengths ?? []),
      signal?.why ?? "",
      signal?.businessObjectiveSupport ?? "",
    ],
    limit
  );
  return {
    label: "Recommended for this campaign",
    tone: "positive",
    reasons: reasons.length > 0 ? reasons : ["Matches the campaign's creator requirements."],
  };
}
