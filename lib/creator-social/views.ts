import type { SocialCapability } from "./providers/types";
import type { SocialProviderId } from "./ids";
import { listSocialProviders } from "./providers/registry";
import {
  creatorFacingConnectionLabel,
  creatorFacingSyncLine,
  type CreatorSocialConnectionStatus,
} from "./connections/status";
import type { CreatorSocialConnectionRow } from "./connections/service";

export type CreatorSocialProviderView = {
  providerId: SocialProviderId;
  displayName: string;
  configured: boolean;
  capabilities: readonly SocialCapability[];
  connection: {
    id: string;
    handle: string | null;
    status: CreatorSocialConnectionStatus;
    statusLabel: string;
    syncLine: string | null;
    lastSyncedAt: string | null;
  } | null;
};

export function buildCreatorSocialProviderViews(
  connections: readonly CreatorSocialConnectionRow[]
): CreatorSocialProviderView[] {
  const active = connections.filter((row) => row.status !== "disconnected");
  const byProvider = new Map<SocialProviderId, CreatorSocialConnectionRow>();
  for (const row of active) {
    if (!byProvider.has(row.provider)) byProvider.set(row.provider, row);
  }

  return listSocialProviders().map((provider) => {
    const connection = byProvider.get(provider.id) ?? null;
    return {
      providerId: provider.id,
      displayName: provider.displayName,
      configured: provider.isConfigured(),
      capabilities: provider.capabilities,
      connection: connection
        ? {
            id: connection.id,
            handle: connection.external_username
              ? `@${connection.external_username.replace(/^@/, "")}`
              : connection.external_display_name,
            status: connection.status,
            statusLabel: creatorFacingConnectionLabel(
              connection.status,
              connection.last_synced_at
            ),
            syncLine: creatorFacingSyncLine(
              connection.status,
              connection.last_synced_at
            ),
            lastSyncedAt: connection.last_synced_at,
          }
        : null,
    };
  });
}

export type InternalSocialConnectionView = {
  providerId: SocialProviderId;
  displayName: string;
  handle: string | null;
  status: CreatorSocialConnectionStatus;
  statusLabel: string;
  lastSyncedAt: string | null;
  capabilities: string[];
};

export function buildInternalSocialConnectionViews(
  connections: readonly CreatorSocialConnectionRow[]
): InternalSocialConnectionView[] {
  return connections
    .filter((row) => row.status !== "disconnected")
    .map((row) => ({
      providerId: row.provider,
      displayName: listSocialProviders().find((item) => item.id === row.provider)?.displayName ?? row.provider,
      handle: row.external_username
        ? `@${row.external_username.replace(/^@/, "")}`
        : row.external_display_name,
      status: row.status,
      statusLabel: creatorFacingConnectionLabel(row.status, row.last_synced_at),
      lastSyncedAt: row.last_synced_at,
      capabilities: row.capabilities,
    }));
}
