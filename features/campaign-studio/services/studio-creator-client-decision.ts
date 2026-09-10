/**
 * The client-facing terminology boundary.
 *
 * Enterprise Creator Intelligence is a decision-support layer. Its reasoning
 * was being printed onto the ordinary creator card verbatim — "Overall score 40
 * with multiple high risks", "Mixed investment signals", "Commercial outlook
 * weak", "Evidence does not support selection", a raw confidence percentage —
 * which is internal analyst language, not something to put in front of a
 * client.
 *
 * This module owns only that boundary: which already-written lines may reach a
 * client-facing surface. It used to also decide the creator's status from the
 * ECI verdict; the campaign decision now lives in
 * `resolveCampaignCreatorDecision`, built from campaign requirements, so an
 * investment reading can no longer become the campaign's answer.
 *
 * Nothing here changes an ECI calculation, a score, or a gate.
 */

/**
 * Terms that belong to the internal layer. A card must not contain these.
 * Used both to filter reason text and by the regression test.
 */
export const INTERNAL_TERMINOLOGY: readonly RegExp[] = [
  /enterprise creator intelligence/i,
  /\bECI\b/,
  /overall score\s*\d/i,
  /\b(?:mixed|weak|strong|limited)\s+investment\s+signals?/i,
  /investment signals?/i,
  /investment readiness/i,
  /\binvestment score\b/i,
  /limited (?:campaign history|commercial data)/i,
  /pricing volatility/i,
  /planning (?:layer|workspace)/i,
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
