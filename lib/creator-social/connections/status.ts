export const CREATOR_SOCIAL_CONNECTION_STATUSES = [
  "pending",
  "connected",
  "syncing",
  "needs_attention",
  "disconnected",
] as const;

export type CreatorSocialConnectionStatus =
  (typeof CREATOR_SOCIAL_CONNECTION_STATUSES)[number];

export function creatorFacingConnectionLabel(
  status: CreatorSocialConnectionStatus,
  lastSyncedAt: string | null
): string {
  if (status === "syncing") return "Syncing";
  if (status === "needs_attention") return "Connection needs attention";
  if (status === "disconnected") return "Disconnected";
  if (status === "pending") return "Not connected";
  if (lastSyncedAt) return "Connected";
  return "Connected";
}

export function creatorFacingSyncLine(
  status: CreatorSocialConnectionStatus,
  lastSyncedAt: string | null
): string | null {
  if (status === "syncing") return "Syncing your insights…";
  if (status === "needs_attention") return "Reconnect to continue syncing insights.";
  if (status === "disconnected" || status === "pending") return null;
  if (!lastSyncedAt) return "Syncing your insights…";
  return `Last synced ${formatRelativeSync(lastSyncedAt)}`;
}

export function formatRelativeSync(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "recently";
  const deltaMin = Math.max(0, Math.round((now - then) / 60000));
  if (deltaMin < 1) return "just now";
  if (deltaMin === 1) return "1 minute ago";
  if (deltaMin < 60) return `${deltaMin} minutes ago`;
  const hours = Math.round(deltaMin / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
