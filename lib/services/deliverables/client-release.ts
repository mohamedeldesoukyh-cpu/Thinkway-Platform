/** Client-visibility contract for documentation versions. Not a new SSOT. */

export const RELEASED_TO_CLIENT_AT_KEY = "released_to_client_at";

export type VersionReleaseMetadata = {
  [RELEASED_TO_CLIENT_AT_KEY]?: string | null;
};

export function releasedToClientAtFromMetadata(
  metadata: unknown
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[RELEASED_TO_CLIENT_AT_KEY];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isVersionReleasedToClient(metadata: unknown): boolean {
  return releasedToClientAtFromMetadata(metadata) !== null;
}

export function versionReleaseMetadata(releaseToClient: boolean): Record<string, unknown> {
  return {
    [RELEASED_TO_CLIENT_AT_KEY]: releaseToClient ? new Date().toISOString() : null,
  };
}

export function mergeReleasedToClientMetadata(
  metadata: Record<string, unknown> | null | undefined,
  releasedAt: string
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [RELEASED_TO_CLIENT_AT_KEY]: releasedAt,
  };
}
