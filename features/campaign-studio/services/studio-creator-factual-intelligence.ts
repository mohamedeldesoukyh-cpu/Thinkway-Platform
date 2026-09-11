/**
 * Creator Details · Campaign tab — measurements, not a verdict.
 *
 * Browser evidence: opening `esraafahmy` showed "Not Recommended: do not
 * prioritize esraafahmy for this campaign", then "Why: Weak overall investment
 * score (42) relative to commercial risk tolerance", "Business value: High
 * Risk", "Risk: Pricing volatility". That is the internal decision narrative
 * (`toExecutiveCreatorDetailView`) rendered verbatim, so Creator Details read
 * as Thinkway instructing the operator not to use the creator.
 *
 * Creator Details is a factual surface. Negative FACTS stay — an investment
 * score of 42, source confidence of 52%, unverified status, a missing quote
 * reference, limited history are all real and must be visible. What goes is the
 * prescription: no "Not Recommended", no "do not prioritize", no "High Risk",
 * no "pursue the alternate path". And nothing positive is invented in its
 * place: an absent measurement is reported as absent.
 *
 * The campaign's decision still exists and still shows where it belongs — on
 * the creator card and in the recommendation groups, from
 * `resolveCampaignCreatorDecision`. No ECI calculation changes; the signal is
 * read exactly as produced.
 */

import type { StudioEciPlanningSignal } from "./eci/project-studio-eci-signal";
import { containsInternalTerminology } from "./studio-creator-client-decision";

export type CreatorFactRow = {
  label: string;
  /** The measurement as written, or null when there is none. */
  value: string | null;
};

export type CreatorFactualIntelligence = {
  /** Measurements that exist, in reading order. */
  measurements: CreatorFactRow[];
  /** Observations drawn from the signal's own evidence, kept factual. */
  observations: string[];
  /** Named explicitly, so absent data never reads as a negative judgement. */
  missing: string[];
};

/** Prescriptive wording that must never reach this surface. */
export const PRESCRIPTIVE_LANGUAGE: readonly RegExp[] = [
  /\bnot recommended\b/i,
  /\bdo not (?:prioriti[sz]e|select|use|book|proceed)\b/i,
  /\breject(?:ed|ion)?\b/i,
  /\bavoid\b/i,
  /\bhigh risk\b/i,
  /\balternate path\b/i,
  /\bprioriti[sz]e\b/i,
  /\brecommended for this campaign\b/i,
  /\bshould (?:not )?(?:be )?(?:used|selected|booked)\b/i,
  /\bweak\b/i,
  /\bstrong(?:est)? (?:choice|fit|candidate)\b/i,
];

export function containsPrescriptiveLanguage(text: string): boolean {
  return PRESCRIPTIVE_LANGUAGE.some((pattern) => pattern.test(text));
}

/** A line may appear only if it is neither internal jargon nor a prescription. */
function isFactualLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 6 || trimmed.length > 160) return false;
  if (containsInternalTerminology(trimmed)) return false;
  if (containsPrescriptiveLanguage(trimmed)) return false;
  return true;
}

function percent(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value)}%`;
}

function score(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value)}/100`;
}

export function creatorFactualIntelligence(
  signal: StudioEciPlanningSignal | null | undefined
): CreatorFactualIntelligence {
  if (!signal) {
    return {
      measurements: [],
      observations: [],
      missing: ["Creator intelligence has not been loaded for this campaign yet."],
    };
  }

  const rows: CreatorFactRow[] = [
    { label: "Investment score", value: score(signal.investmentScore) },
    { label: "Source confidence", value: percent(signal.confidencePercent) },
    // "Evidence coverage" is analyst vocabulary and is flagged as such by the
    // terminology boundary. The measurement is the same; the label is plain.
    { label: "Data coverage", value: percent(signal.evidenceCoveragePercent) },
  ];

  const measurements = rows.filter((row) => row.value != null);
  const missing = rows
    .filter((row) => row.value == null)
    .map((row) => `${row.label}: not available.`);

  /*
   * The signal's own evidence lines, kept only where they read as observations.
   * `risks` is included deliberately: "Missing quote reference" and "Limited
   * historical evidence" are facts an operator needs. A line phrased as a
   * verdict ("High Risk", "Weak overall investment score") is dropped rather
   * than reworded — rewording an internal judgement still surfaces it.
   */
  const seen = new Set<string>();
  const observations: string[] = [];
  for (const line of [...(signal.evidence ?? []), ...(signal.risks ?? [])]) {
    const trimmed = line?.replace(/\s+/g, " ").trim() ?? "";
    if (!isFactualLine(trimmed)) continue;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    observations.push(trimmed.endsWith(".") ? trimmed : `${trimmed}.`);
    if (observations.length >= 6) break;
  }

  if (observations.length === 0) {
    missing.push("Supporting evidence: none recorded for this creator yet.");
  }

  return { measurements, observations, missing };
}
