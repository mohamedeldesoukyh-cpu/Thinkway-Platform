import type { CreatorIntelligenceSnapshot } from "./snapshot-types";

export const SNAPSHOT_VERSION = "2.4";
export const PROVIDER_VERSION = "2.4";
export const SCHEMA_VERSION = "1.0";

export function readSnapshotVersion(snapshot: CreatorIntelligenceSnapshot): string {
  const version = snapshot.metadata.snapshotVersion;
  return typeof version === "string" ? version : SNAPSHOT_VERSION;
}

export function buildSnapshotVersionMetadata(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    providerVersion: PROVIDER_VERSION,
    schemaVersion: SCHEMA_VERSION,
    ...overrides,
  };
}
