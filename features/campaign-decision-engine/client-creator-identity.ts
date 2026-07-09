/**
 * Resolve human-readable labels for client creator ids (`client_inf:uuid`, URL slugs, etc.).
 */

import type { CreatorDNADocument } from "@/features/creator-dna/types";

import type { SimulationCreator } from "./decision-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function stripClientCreatorPrefix(creatorId: string): string {
  return creatorId.startsWith("client_") ? creatorId.slice(7) : creatorId;
}

export function normalizeInfluencerLookupId(id: string): string {
  const stripped = stripClientCreatorPrefix(id);
  if (stripped.startsWith("inf:")) return stripped.slice(4);
  if (stripped.startsWith("dis:")) return stripped.slice(4);
  return stripped;
}

function isInternalCreatorId(value: string): boolean {
  const stripped = stripClientCreatorPrefix(value);
  return (
    stripped.startsWith("inf:") ||
    stripped.startsWith("dis:") ||
    UUID_PATTERN.test(stripped) ||
    stripped.startsWith("client_")
  );
}

function formatSlugLabel(slug: string): string {
  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatHandleLabel(handle: string): string {
  const normalized = handle.replace(/^@/, "");
  return normalized
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function parseClientCreatorSlug(creatorId: string): {
  platform?: string;
  handle?: string;
  label?: string;
} {
  const stripped = stripClientCreatorPrefix(creatorId);
  if (stripped.startsWith("inf:") || stripped.startsWith("dis:") || UUID_PATTERN.test(stripped)) {
    return {};
  }

  const platformMatch = stripped.match(/^(instagram|tiktok|youtube)_(.+)$/i);
  if (platformMatch) {
    const handle = platformMatch[2].replace(/^@/, "");
    return {
      platform: platformMatch[1].toLowerCase(),
      handle: `@${handle}`,
      label: formatHandleLabel(handle),
    };
  }

  return { label: formatSlugLabel(stripped) };
}

export function lookupCreatorDna(
  dnaMap: Map<string, CreatorDNADocument> | undefined,
  creatorId: string
): CreatorDNADocument | undefined {
  if (!dnaMap) return undefined;

  const direct = dnaMap.get(creatorId);
  if (direct) return direct;

  const stripped = stripClientCreatorPrefix(creatorId);
  const strippedMatch = dnaMap.get(stripped);
  if (strippedMatch) return strippedMatch;

  const influencerId = normalizeInfluencerLookupId(creatorId);
  return dnaMap.get(influencerId) ?? dnaMap.get(`inf:${influencerId}`) ?? dnaMap.get(`dis:${influencerId}`);
}

export function findBaselineCreatorMatch(
  creators: SimulationCreator[],
  creatorId: string
): SimulationCreator | undefined {
  const stripped = stripClientCreatorPrefix(creatorId);
  const normalizedTarget = normalizeInfluencerLookupId(creatorId);

  return creators.find((creator) => {
    if (creator.id === creatorId || creator.id === stripped) return true;
    return normalizeInfluencerLookupId(creator.id) === normalizedTarget;
  });
}

export function resolveClientCreatorDisplayName(
  creatorId: string,
  fallback?: Pick<SimulationCreator, "displayName" | "handle">
): { displayName: string; handle: string } {
  const parsed = parseClientCreatorSlug(creatorId);

  if (fallback?.displayName && !isInternalCreatorId(fallback.displayName)) {
    return {
      displayName: fallback.displayName,
      handle: fallback.handle ?? fallback.displayName,
    };
  }

  if (parsed.handle && parsed.label) {
    return { displayName: parsed.label, handle: parsed.handle };
  }

  if (parsed.label) {
    return {
      displayName: parsed.label,
      handle: fallback?.handle && !isInternalCreatorId(fallback.handle)
        ? fallback.handle
        : `@${parsed.label.replace(/\s+/g, "").toLowerCase()}`,
    };
  }

  if (fallback?.displayName) {
    return {
      displayName: fallback.displayName,
      handle: fallback.handle ?? fallback.displayName,
    };
  }

  return { displayName: "Client Creator", handle: "Unknown" };
}

export function isRawClientCreatorId(value: string | undefined): boolean {
  if (!value) return true;
  return isInternalCreatorId(value) || value.startsWith("client_");
}
