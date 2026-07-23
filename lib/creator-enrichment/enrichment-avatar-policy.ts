import { avatarStorageQualityRank } from "@/lib/creators/creator-centric";
import { parseCreatorAvatarStoragePathFromUrl } from "@/lib/discovery-import/import-avatar-storage";
import {
  isDisplayableAvatarUrl,
  isUsableAvatarUrl,
} from "@/lib/performance/avatar-sync-policy";

import type { EnrichmentScope } from "./enabled";

/** Whether enrichment scope explicitly targets avatar field updates. */
export function isAvatarEnrichmentScope(scope: EnrichmentScope | undefined): boolean {
  const resolved = scope ?? "all";
  return resolved === "all" || resolved === "avatar";
}

/**
 * Resolve avatar persist flags for an Apify enrichment run.
 *
 * Avatar persist is attempted whenever Apify returns a profile photo (even on
 * metrics-only refresh). Scope only controls whether policy may be bypassed.
 */
export function resolveApifyAvatarPersistOptions(input: {
  scope?: EnrichmentScope;
  force?: boolean;
  bypassMetricsManualOverride?: boolean;
  forceAvatarReplace?: boolean;
}): { forceSync: boolean; forceAvatarReplace: boolean } {
  const avatarScope = isAvatarEnrichmentScope(input.scope);
  return {
    forceSync: avatarScope && Boolean(input.force || input.bypassMetricsManualOverride),
    forceAvatarReplace: avatarScope && Boolean(input.forceAvatarReplace),
  };
}

/** True when the URL is a Thinkway creator-avatars storage object (non-expiring). */
export function isDurableCreatorAvatarUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  return Boolean(parseCreatorAvatarStoragePathFromUrl(trimmed));
}

export type NextPrimaryAvatarInput = {
  existingUrl: string | null | undefined;
  existingSource?: string | null;
  incomingUrl: string | null | undefined;
  incomingSource?: string | null;
};

/**
 * Merge rule for influencers.primary_avatar_url on enrichment / identity persist.
 *
 * - Never clear an existing avatar when incoming is null / unusable / placeholder
 * - Only replace when incoming is a usable (or clearly better durable) avatar
 * - Prefer durable storage URLs over expiring social CDN links
 * - Manual avatars are never replaced by automated enrichment
 */
export function resolveNextPrimaryAvatar(input: NextPrimaryAvatarInput): {
  url: string | null;
  source: string | null;
} {
  const existing = input.existingUrl?.trim() || null;
  const existingSource = existing ? (input.existingSource?.trim() || null) : null;
  const incoming = input.incomingUrl?.trim() || null;
  const incomingSourceRaw = input.incomingSource?.trim() || null;

  if (!incoming || incomingSourceRaw === "placeholder") {
    return { url: existing, source: existingSource };
  }

  if (!isDisplayableAvatarUrl(incoming)) {
    return { url: existing, source: existingSource };
  }

  if (existingSource === "manual" && existing) {
    return { url: existing, source: existingSource };
  }

  const incomingSource = incomingSourceRaw;
  const existingDurable = isDurableCreatorAvatarUrl(existing);
  const incomingDurable = isDurableCreatorAvatarUrl(incoming);
  const existingUsable = isUsableAvatarUrl(existing);
  const incomingUsable = isUsableAvatarUrl(incoming);

  // Never replace a durable Thinkway avatar with an ephemeral CDN URL.
  if (existingDurable && !incomingDurable) {
    return { url: existing, source: existingSource };
  }

  if (incomingDurable && !existingDurable) {
    return { url: incoming, source: incomingSource ?? "uploaded" };
  }

  if (incomingDurable && existingDurable) {
    const incomingRank = avatarStorageQualityRank(incoming);
    const existingRank = avatarStorageQualityRank(existing);
    if (incomingRank > existingRank) {
      return { url: incoming, source: incomingSource ?? "uploaded" };
    }
    if (incomingRank < existingRank) {
      return { url: existing, source: existingSource };
    }
  }

  if (incomingUsable && !existingUsable) {
    return { url: incoming, source: incomingSource };
  }

  if (incomingUsable) {
    return { url: incoming, source: incomingSource };
  }

  // Incoming is displayable but expired/broken CDN — keep prior avatar when present.
  if (existing) {
    return { url: existing, source: existingSource };
  }

  return { url: incoming, source: incomingSource };
}
