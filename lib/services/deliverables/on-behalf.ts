/**
 * Internal on-behalf attribution for documentation units.
 * Reuses existing version metadata + documentation events. No new table.
 */

export const ON_BEHALF_SOURCE = "internal_on_behalf";

export const ON_BEHALF_SOURCE_KEY = "source";
export const ON_BEHALF_INFLUENCER_ID_KEY = "on_behalf_of_influencer_id";
export const ON_BEHALF_KIND_KEY = "on_behalf_kind";
export const ON_BEHALF_ACTOR_USER_ID_KEY = "on_behalf_actor_user_id";

export const CREATOR_ON_BEHALF_ACTOR_LABEL = "Thinkway";

export const CREATOR_ON_BEHALF_SUBMITTED_LABEL =
  "Submitted by Thinkway on your behalf";

export const CREATOR_ON_BEHALF_UPDATED_LABEL =
  "Updated by Thinkway on your behalf";

export const ON_BEHALF_INTERNAL_ONLY_MESSAGE =
  "Sign in with your Internal Thinkway account to complete work on behalf of a creator.";

export const ON_BEHALF_NO_CREATOR_MESSAGE =
  "This slot is not assigned to a creator.";

export const DOCUMENTATION_VERSION_CONFLICT_MESSAGE =
  "A newer version was added. Refresh and try again.";

export type OnBehalfKind = "submit" | "update";

export type OnBehalfAttribution = {
  influencerId: string;
  actorUserId: string;
  kind: OnBehalfKind;
};

export function onBehalfKindForVersionNumber(versionNumber: number): OnBehalfKind {
  return versionNumber <= 1 ? "submit" : "update";
}

export function creatorFacingOnBehalfLabel(
  kind: OnBehalfKind | null | undefined
): string | null {
  if (kind === "submit") return CREATOR_ON_BEHALF_SUBMITTED_LABEL;
  if (kind === "update") return CREATOR_ON_BEHALF_UPDATED_LABEL;
  return null;
}

export function parseOnBehalfKind(value: unknown): OnBehalfKind | null {
  return value === "submit" || value === "update" ? value : null;
}

export function onBehalfAttributionFromMetadata(
  metadata: unknown
): OnBehalfAttribution | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  if (record[ON_BEHALF_SOURCE_KEY] !== ON_BEHALF_SOURCE) return null;
  const influencerId = record[ON_BEHALF_INFLUENCER_ID_KEY];
  const actorUserId = record[ON_BEHALF_ACTOR_USER_ID_KEY];
  const kind = parseOnBehalfKind(record[ON_BEHALF_KIND_KEY]);
  if (typeof influencerId !== "string" || !influencerId.trim()) return null;
  if (typeof actorUserId !== "string" || !actorUserId.trim()) return null;
  if (!kind) return null;
  return {
    influencerId: influencerId.trim(),
    actorUserId: actorUserId.trim(),
    kind,
  };
}

export function onBehalfMetadata(
  attribution: OnBehalfAttribution | null | undefined
): Record<string, unknown> {
  if (!attribution) return {};
  return {
    [ON_BEHALF_SOURCE_KEY]: ON_BEHALF_SOURCE,
    [ON_BEHALF_INFLUENCER_ID_KEY]: attribution.influencerId,
    [ON_BEHALF_KIND_KEY]: attribution.kind,
    [ON_BEHALF_ACTOR_USER_ID_KEY]: attribution.actorUserId,
  };
}

export function onBehalfEventPayload(
  attribution: OnBehalfAttribution | null | undefined
): Record<string, unknown> {
  if (!attribution) return {};
  return {
    source: ON_BEHALF_SOURCE,
    on_behalf_of_influencer_id: attribution.influencerId,
    on_behalf_kind: attribution.kind,
    on_behalf_actor_user_id: attribution.actorUserId,
  };
}

export function isDocumentationVersionConflict(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  if (error.code === "23505") return true;
  const message = error.message ?? "";
  return /duplicate key|unique constraint|version_number/i.test(message);
}
