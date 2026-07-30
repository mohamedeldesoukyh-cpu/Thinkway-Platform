/**
 * Release 2.1 — multi Media Plan identity metadata on campaign_objects.
 * No new tables: classification lives on Campaign Object meta.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

export type MediaPlanKind =
  | "default"
  | "platform"
  | "country"
  | "phase"
  | "budget"
  | "seasonal"
  | "historical"
  | "other";

export type MediaPlanIdentityMeta = {
  /** Human label shown in selectors (e.g. "Instagram — KSA Wave 1"). */
  label?: string | null;
  kind?: MediaPlanKind | null;
  platform?: string | null;
  country?: string | null;
  phase?: string | null;
  /** Optional free-form tags for filtering. */
  tags?: string[];
};

export function mediaPlanIdentityFromMeta(
  meta: CampaignObject["meta"] | undefined
): MediaPlanIdentityMeta {
  const raw = (meta as { mediaPlanIdentity?: MediaPlanIdentityMeta } | undefined)
    ?.mediaPlanIdentity;
  if (!raw || typeof raw !== "object") {
    return { kind: "default", label: null };
  }
  return {
    label: raw.label?.trim() || null,
    kind: raw.kind ?? "default",
    platform: raw.platform?.trim() || null,
    country: raw.country?.trim() || null,
    phase: raw.phase?.trim() || null,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === "string") : undefined,
  };
}

export function withMediaPlanIdentity(
  campaignObject: CampaignObject,
  identity: MediaPlanIdentityMeta
): CampaignObject {
  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      mediaPlanIdentity: {
        ...mediaPlanIdentityFromMeta(campaignObject.meta),
        ...identity,
      },
    } as CampaignObject["meta"],
  };
}

export function displayLabelForMediaPlanIdentity(
  identity: MediaPlanIdentityMeta,
  fallback = "Media Plan"
): string {
  if (identity.label?.trim()) return identity.label.trim();
  const parts = [
    identity.platform,
    identity.country,
    identity.phase,
    identity.kind && identity.kind !== "default" ? identity.kind : null,
  ].filter((part): part is string => Boolean(part?.trim()));
  return parts.length ? parts.join(" · ") : fallback;
}
