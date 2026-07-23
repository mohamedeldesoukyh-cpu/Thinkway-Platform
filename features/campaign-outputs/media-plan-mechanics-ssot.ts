/**
 * Campaign mechanics SSOT — only mention UGC, duets, stitches, etc. when present in brief or quotation.
 */

import { parseAggregatedServiceLabel } from "./hydration/quotation-service-types";
import { isUgcServiceType } from "./media-plan-deliverable-classification";
import type { SlateCreator } from "./output-inputs";

export type CampaignMechanic =
  | "ugc"
  | "duet"
  | "stitch"
  | "challenge"
  | "live"
  | "stories"
  | "reels";

const MECHANIC_PATTERNS: Record<CampaignMechanic, RegExp> = {
  ugc: /\bugc\b|user[-\s]?generated/i,
  duet: /\bduets?\b/i,
  stitch: /\bstitches?\b/i,
  challenge: /\bchallenge|competition|contest\b/i,
  live: /\blive\s+(stream|session|broadcast)|\bgo\s+live\b/i,
  stories: /\bstories?\b/i,
  reels: /\breels?\b/i,
};

function serviceTypesForCreator(creator: SlateCreator): string[] {
  if (creator.serviceTypes?.length) return creator.serviceTypes;
  if (creator.serviceLabel?.trim()) {
    return parseAggregatedServiceLabel(creator.serviceLabel);
  }
  return [];
}

/** Mechanics explicitly present in quotation service types. */
export function quotationMechanics(slate: SlateCreator[]): Set<CampaignMechanic> {
  const allowed = new Set<CampaignMechanic>();
  const joined = slate
    .flatMap((creator) => serviceTypesForCreator(creator))
    .join(" ")
    .toLowerCase();

  for (const [mechanic, pattern] of Object.entries(MECHANIC_PATTERNS) as Array<
    [CampaignMechanic, RegExp]
  >) {
    if (pattern.test(joined)) allowed.add(mechanic);
  }

  if (slate.some((creator) => serviceTypesForCreator(creator).some((type) => isUgcServiceType(type, creator)))) {
    allowed.add("ugc");
  }

  return allowed;
}

/** Mechanics explicitly mentioned in campaign brief or objective text. */
export function briefMechanics(briefText: string, objective?: string): Set<CampaignMechanic> {
  const combined = `${objective ?? ""}\n${briefText}`;
  const allowed = new Set<CampaignMechanic>();

  for (const [mechanic, pattern] of Object.entries(MECHANIC_PATTERNS) as Array<
    [CampaignMechanic, RegExp]
  >) {
    if (pattern.test(combined)) allowed.add(mechanic);
  }

  return allowed;
}

/** Union of brief and quotation mechanics — the only mechanics narrative may reference. */
export function resolveAllowedMechanics(input: {
  briefText: string;
  objective?: string;
  slate?: SlateCreator[];
}): Set<CampaignMechanic> {
  const allowed = briefMechanics(input.briefText, input.objective);
  for (const mechanic of quotationMechanics(input.slate ?? [])) {
    allowed.add(mechanic);
  }
  return allowed;
}

export function mechanicAllowed(
  allowed: Set<CampaignMechanic>,
  mechanic: CampaignMechanic
): boolean {
  return allowed.has(mechanic);
}

const DISALLOWED_MECHANIC_CHECKS: Array<[CampaignMechanic, RegExp]> = [
  ["ugc", /\bugc\b|user[-\s]?generated/i],
  ["duet", /\bduets?\b/i],
  ["stitch", /\bstitches?\b/i],
  ["challenge", /\bchallenges?\b/i],
  ["challenge", /\bcompetition|contest\b/i],
  ["challenge", /\bwinner|winners?\b/i],
];

/** True when narrative text references a mechanic not in the allowed set. */
export function narrativeReferencesDisallowedMechanic(
  text: string,
  allowed: Set<CampaignMechanic>
): boolean {
  for (const [mechanic, pattern] of DISALLOWED_MECHANIC_CHECKS) {
    if (!mechanicAllowed(allowed, mechanic) && pattern.test(text)) return true;
  }
  return false;
}

/** Strip or replace disallowed mechanic references from creative copy. */
export function sanitizeMechanicReferences(text: string, allowed: Set<CampaignMechanic>): string {
  if (!narrativeReferencesDisallowedMechanic(text, allowed)) return text;

  let sanitized = text;
  if (!mechanicAllowed(allowed, "challenge")) {
    sanitized = sanitized
      .replace(/\b(challenge|competition|contest|winner reveal)\b/gi, "call-to-action")
      .replace(/\bUGC\b/g, "creator content");
  }
  if (!mechanicAllowed(allowed, "ugc")) {
    sanitized = sanitized.replace(/\bUGC\b/g, "creator content");
  }
  if (!mechanicAllowed(allowed, "duet")) {
    sanitized = sanitized.replace(/\bduets?\b/gi, "collaboration");
  }
  if (!mechanicAllowed(allowed, "stitch")) {
    sanitized = sanitized.replace(/\bstitches?\b/gi, "response content");
  }
  return sanitized;
}
