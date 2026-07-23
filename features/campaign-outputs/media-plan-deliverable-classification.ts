import type { SlateCreator } from "./output-inputs";

export type DeliverableRole = "hero" | "support" | "ugc" | "mirror";

/** Service-type label contains mirror / mirrored wording. */
export function isMirrorServiceType(serviceType: string): boolean {
  return /\bmirror(?:ed)?\b/i.test(serviceType.trim());
}

/**
 * UGC deliverable — only when the quotation explicitly labels it UGC.
 * Platform names, creator handles, and tier must never infer UGC classification.
 */
export function isUgcServiceType(serviceType: string, _creator?: SlateCreator): boolean {
  return /\bugc\b/i.test(serviceType.trim());
}

export function classifyDeliverableRole(
  serviceType: string,
  creator: SlateCreator,
  tierRank: number
): DeliverableRole {
  if (isMirrorServiceType(serviceType)) return "mirror";
  if (isUgcServiceType(serviceType, creator)) return "ugc";
  if (tierRank <= 1) return "hero";
  return "support";
}

/** Brief explicitly requests UGC from campaign start. */
export function briefAllowsEarlyUgc(briefText: string): boolean {
  return /\b(immediate\s+ugc|ugc\s+from\s+day\s*1|ugc\s+from\s+the\s+start|day\s*1\s+ugc|ugc\s+from\s+launch)\b/i.test(
    briefText
  );
}

/**
 * Earliest campaign week (1-based) where UGC may be scheduled.
 * Default: final ~35% of campaign (Week 3+ on a 4-week plan).
 */
export function resolveUgcEarliestWeek(
  durationWeeks: number,
  briefText: string,
  objective?: string
): number {
  if (briefAllowsEarlyUgc(briefText)) return 1;

  const finalPhaseStart = Math.max(1, Math.ceil(durationWeeks * 0.65));
  const combined = `${objective ?? ""}\n${briefText}`.toLowerCase();

  if (/\bchallenge\b/i.test(combined)) {
    return Math.max(finalPhaseStart, Math.ceil(durationWeeks * 0.5));
  }
  if (/\b(product\s+launch|launch|drop|new\s+product|go[-\s]?live)\b/i.test(combined)) {
    return Math.max(finalPhaseStart, Math.ceil(durationWeeks * 0.5));
  }
  if (/\bawareness|reach\b/i.test(combined)) {
    return Math.max(finalPhaseStart, Math.ceil(durationWeeks * 0.65));
  }

  return finalPhaseStart;
}

export function isStoryLikeServiceType(serviceType: string): boolean {
  return /\bstor(?:y|ies)\b/i.test(serviceType);
}

export function isVideoLikeServiceType(serviceType: string): boolean {
  const lower = serviceType.toLowerCase();
  return (
    /\bvideo\b|\breel\b|\bpost\b|\bshort\b|\blive\b/i.test(lower) &&
    !isMirrorServiceType(serviceType) &&
    !isStoryLikeServiceType(serviceType)
  );
}

/** Prefer pairing mirrors with the primary video/reel on the same creator. */
function mirrorPairScore(original: string, mirror: string): number {
  const mirrorLower = mirror.toLowerCase();
  const originalLower = original.toLowerCase();

  if (/\bmirrored\s+ig\b/i.test(mirrorLower) && /\btt\b|tiktok/i.test(originalLower)) return 10;
  if (/\bmirrored\s+tt\b/i.test(mirrorLower) && /\big\b|instagram/i.test(originalLower)) return 10;
  if (/\bmirrored\s+fb\b/i.test(mirrorLower) && /\btt\b|tiktok/i.test(originalLower)) return 8;
  if (/\bmirrored\s+yt\b/i.test(mirrorLower) && /\btt\b|tiktok/i.test(originalLower)) return 8;
  if (isVideoLikeServiceType(original)) return 5;
  return 1;
}

export type ClassifiedDeliverableUnit = {
  slotId: string;
  creator: SlateCreator;
  serviceType: string;
  platform: string;
  deliverableIndex: number;
  deliverableTotal: number;
  creatorRound: number;
  tierRank: number;
  role: DeliverableRole;
  countsAsActivation: boolean;
  attachedMirrors?: ClassifiedDeliverableUnit[];
  attachedCompanions?: ClassifiedDeliverableUnit[];
};

export type CollapseMirrorsResult = {
  activations: ClassifiedDeliverableUnit[];
  /** Raw deliverable count including mirrors — for service-type listings. */
  rawDeliverableCount: number;
};

/**
 * Attach mirror lines to their original activation on the same creator.
 * Mirrors are removed from the top-level activation list.
 */
export function collapseMirrorsToActivations<
  T extends {
    slotId: string;
    creator: SlateCreator;
    serviceType: string;
    platform: string;
    deliverableIndex: number;
    deliverableTotal: number;
    creatorRound: number;
    tierRank: number;
    role: DeliverableRole;
    countsAsActivation: boolean;
    attachedMirrors?: ClassifiedDeliverableUnit[];
  },
>(units: T[]): CollapseMirrorsResult {
  const byCreator = new Map<string, T[]>();
  for (const unit of units) {
    const key = unit.creator.creatorId.trim().toLowerCase();
    const list = byCreator.get(key) ?? [];
    list.push(unit);
    byCreator.set(key, list);
  }

  const activations: ClassifiedDeliverableUnit[] = [];
  let rawCount = 0;

  for (const creatorUnits of byCreator.values()) {
    rawCount += creatorUnits.length;
    const mirrors = creatorUnits.filter((unit) => unit.role === "mirror");
    const originals = creatorUnits.filter((unit) => unit.role !== "mirror");
    const mirrorsByOriginal = new Map<string, ClassifiedDeliverableUnit[]>();

    for (const mirror of mirrors) {
      let bestOriginal = originals[0];
      let bestScore = -1;
      for (const original of originals) {
        const score = mirrorPairScore(original.serviceType, mirror.serviceType);
        if (score > bestScore) {
          bestScore = score;
          bestOriginal = original;
        }
      }
      if (!bestOriginal) continue;
      const attached = mirrorsByOriginal.get(bestOriginal.slotId) ?? [];
      attached.push({ ...mirror, attachedMirrors: [], countsAsActivation: false });
      mirrorsByOriginal.set(bestOriginal.slotId, attached);
    }

    for (const original of originals) {
      activations.push({
        ...original,
        attachedMirrors: mirrorsByOriginal.get(original.slotId) ?? [],
        attachedCompanions: [],
        countsAsActivation: true,
      });
    }
  }

  return { activations, rawDeliverableCount: rawCount };
}

function companionPairScore(primary: string, companion: string): number {
  const primaryLower = primary.toLowerCase();
  const companionLower = companion.toLowerCase();
  if (/\big\b|instagram/i.test(primaryLower) && /\big\b|instagram/i.test(companionLower)) return 10;
  if (/\btt\b|tiktok/i.test(primaryLower) && /\btt\b|tiktok/i.test(companionLower)) return 10;
  if (isVideoLikeServiceType(primary) && isStoryLikeServiceType(companion)) return 8;
  return 1;
}

/**
 * Bundle story/support lines onto the same publish day as the primary reel/video.
 * The Reel drives the calendar moment; Stories support within 24h.
 */
export function bundleCompanionsToActivations<
  T extends {
    slotId: string;
    creator: SlateCreator;
    serviceType: string;
    platform: string;
    deliverableIndex: number;
    deliverableTotal: number;
    creatorRound: number;
    tierRank: number;
    role: DeliverableRole;
    countsAsActivation: boolean;
    attachedMirrors?: ClassifiedDeliverableUnit[];
    attachedCompanions?: ClassifiedDeliverableUnit[];
  },
>(units: T[]): T[] {
  const byCreator = new Map<string, T[]>();
  for (const unit of units) {
    const key = unit.creator.creatorId.trim().toLowerCase();
    const list = byCreator.get(key) ?? [];
    list.push(unit);
    byCreator.set(key, list);
  }

  const bundled: T[] = [];

  for (const creatorUnits of byCreator.values()) {
    const companions = creatorUnits.filter(
      (unit) =>
        unit.role !== "mirror" &&
        unit.role !== "ugc" &&
        isStoryLikeServiceType(unit.serviceType)
    );
    const hosts = creatorUnits.filter(
      (unit) =>
        unit.role !== "mirror" &&
        !isStoryLikeServiceType(unit.serviceType)
    );
    const companionAssigned = new Set<string>();
    const companionsByHost = new Map<string, ClassifiedDeliverableUnit[]>();

    for (const companion of companions) {
      let bestHost = hosts[0];
      let bestScore = -1;
      for (const host of hosts) {
        const score = companionPairScore(host.serviceType, companion.serviceType);
        if (score > bestScore) {
          bestScore = score;
          bestHost = host;
        }
      }
      if (!bestHost) {
        bundled.push({ ...companion, attachedCompanions: [], countsAsActivation: true });
        continue;
      }
      companionAssigned.add(companion.slotId);
      const attached = companionsByHost.get(bestHost.slotId) ?? [];
      attached.push({
        ...companion,
        attachedMirrors: [],
        attachedCompanions: [],
        countsAsActivation: false,
      });
      companionsByHost.set(bestHost.slotId, attached);
    }

    for (const host of hosts) {
      bundled.push({
        ...host,
        attachedMirrors: host.attachedMirrors ?? [],
        attachedCompanions: companionsByHost.get(host.slotId) ?? [],
        countsAsActivation: true,
      });
    }

    for (const companion of companions) {
      if (!companionAssigned.has(companion.slotId)) {
        bundled.push({ ...companion, attachedCompanions: [], countsAsActivation: true });
      }
    }
  }

  return bundled;
}

/** Display label for calendar / export — marks original vs mirror. */
export function formatActivationServiceLabel(
  serviceType: string,
  role: DeliverableRole,
  isMirrorAttachment = false
): string {
  if (role === "mirror" || isMirrorAttachment) {
    return serviceType.includes("(Mirror)")
      ? serviceType
      : `${serviceType.replace(/\s*\(Original\)\s*$/i, "").trim()} (Mirror)`;
  }
  if (isMirrorServiceType(serviceType)) return `${serviceType} (Mirror)`;
  return `${serviceType} (Original)`;
}
