/**
 * Maps Apify normalized + raw IPL snapshot data → Creator DNA field candidates.
 * No second Apify call — uses enrichment snapshot data only.
 */

import type { ApifyProfileData, RecentPublication } from "@/lib/creator-enrichment/types";
import type { NormalizedProfileSnapshot, RawProviderPayload } from "@/lib/intelligence-persistence/types";

import { calculateConfidence, calculateFieldCompleteness } from "./confidence-calculator";
import type { DnaFieldCandidate } from "../types";

export type ApifyToDnaMapperInput = {
  snapshotId: string;
  normalized: NormalizedProfileSnapshot | ApifyProfileData;
  snapshotVersion: number;
  fetchedAt: string;
  platformAccountId?: string | null;
  rawSnapshot?: RawProviderPayload | null;
  /** Storage-hosted avatar URL after enrichment upload (overrides provider CDN). */
  avatarUrlOverride?: string | null;
};

function iplCandidate<T>(
  path: string,
  value: T,
  snapshotId: string,
  snapshotVersion: number,
  fetchedAt: string,
  options?: { isVerified?: boolean }
): DnaFieldCandidate<T> {
  const completeness = calculateFieldCompleteness(value);
  return {
    path,
    value,
    confidence: calculateConfidence({
      source: "ipl",
      hasValue: completeness > 0,
      isVerified: options?.isVerified,
      snapshotVersion,
      fieldCompleteness: completeness,
    }),
    source: "ipl",
    sourceVersion: snapshotVersion,
    updatedAt: fetchedAt,
    snapshotId,
  };
}

/** All ApifyProfileData fields mapped to DNA document paths. */
export const APIFY_DNA_FIELD_PATHS = [
  "identity.displayName",
  "identity.bio",
  "identity.avatarUrl",
  "identity.handle",
  "identity.platform",
  "identity.isVerified",
  "content.profileUrl",
  "content.username",
  "content.recentPublications",
  "metrics.followers",
  "metrics.following",
  "metrics.postsCount",
  "metrics.engagementRate",
  "metrics.avgLikes",
  "metrics.avgComments",
  "metrics.avgViews",
  "audience.country",
  "audience.countries",
  "audience.categories",
  "audience.hashtags",
  "audience.mentions",
  "audience.interests",
  "platforms.primaryPlatform",
  "platforms.accountCount",
  "platforms.crossPlatformReach",
  "contact.email",
  "contact.phone",
  "contact.links",
] as const;

/**
 * Map every normalized Apify field into DNA sections (identity, content, metrics,
 * audience, platforms, contact, meta). Raw snapshot is persisted at row level —
 * not duplicated inside document envelopes.
 */
export function mapApifyToFieldCandidates(
  input: ApifyToDnaMapperInput
): DnaFieldCandidate<unknown>[] {
  const { normalized, snapshotId, snapshotVersion, fetchedAt } = input;
  const candidates: DnaFieldCandidate<unknown>[] = [];

  const push = <T>(
    path: string,
    value: T,
    options?: { isVerified?: boolean }
  ) => {
    candidates.push(iplCandidate(path, value, snapshotId, snapshotVersion, fetchedAt, options));
  };

  const avatarUrl =
    input.avatarUrlOverride?.trim() ||
    normalized.profilePictureUrl?.trim() ||
    null;

  push("identity.displayName", normalized.displayName ?? null);
  push("identity.bio", normalized.bio ?? null);
  push("identity.avatarUrl", avatarUrl);
  push(
    "identity.handle",
    normalized.username ? `@${normalized.username.replace(/^@/, "")}` : null
  );
  push("identity.platform", normalized.platform ?? null);
  push("identity.isVerified", normalized.isVerified ?? null, {
    isVerified: normalized.isVerified ?? false,
  });

  push("content.profileUrl", normalized.profileUrl ?? null);
  push("content.username", normalized.username ?? null);
  push(
    "content.recentPublications",
    (normalized.recentPublications ?? []) as RecentPublication[]
  );

  push("metrics.followers", normalized.followers ?? null);
  push("metrics.following", normalized.following ?? null);
  push("metrics.postsCount", normalized.postsCount ?? null);
  push("metrics.engagementRate", normalized.engagementRate ?? null);
  push("metrics.avgLikes", normalized.avgLikes ?? null);
  push("metrics.avgComments", normalized.avgComments ?? null);
  push("metrics.avgViews", normalized.avgViews ?? null);

  push("audience.country", normalized.audienceCountry ?? null);
  if (normalized.audienceCountry) {
    push("audience.countries", [normalized.audienceCountry]);
  }
  push("audience.categories", normalized.categories ?? []);
  push("audience.hashtags", normalized.hashtags ?? []);
  push("audience.mentions", normalized.mentions ?? []);
  push("audience.interests", normalized.categories ?? []);

  push("platforms.primaryPlatform", normalized.platform ?? null);
  push("platforms.accountCount", 1);
  if (normalized.followers != null) {
    push("platforms.crossPlatformReach", normalized.followers);
  }

  push("contact.email", normalized.contactEmail ?? null);
  push("contact.phone", normalized.contactPhone ?? null);
  push("contact.links", normalized.contactLinks ?? []);

  return candidates;
}

/** Resolve Apify run id from normalized snapshot and optional raw payload. */
export function resolveApifyRunIdFromSnapshot(input: {
  normalized: ApifyProfileData | NormalizedProfileSnapshot;
  rawSnapshot?: RawProviderPayload | null;
}): string | null {
  return input.normalized.apifyRunId ?? input.rawSnapshot?.apifyRunId ?? null;
}
