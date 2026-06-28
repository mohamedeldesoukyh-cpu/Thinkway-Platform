/**
 * Lightweight, dependency-free enrichment view helpers for client components.
 * (Avoids importing the worker/queue lib — which pulls in BullMQ — into the
 * client bundle. Mirrors the canonical type in `lib/creator-enrichment/types`.)
 */

export type CreatorEnrichmentStatus =
  | "never"
  | "queued"
  | "running"
  | "enriched"
  | "partial"
  | "failed"
  | "skipped";

export type DemographicSource =
  | "unavailable"
  | "modash"
  | "hypeauditor"
  | "creatoriq"
  | "apify"
  | "manual";

/** Human "Last Updated" relative label. Returns "Never" when null. */
export function formatLastUpdated(
  value: string | Date | null | undefined,
  now: number = Date.now()
): string {
  if (!value) return "Never";
  const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(ts)) return "Never";

  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Map public sync status (from polling) to enrichment badge status. */
export function syncStatusToEnrichmentStatus(
  status: "pending" | "queued" | "collecting" | "completed" | "failed"
): CreatorEnrichmentStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "collecting":
      return "running";
    case "completed":
      return "enriched";
    case "failed":
      return "failed";
    default:
      return "never";
  }
}

/** Resolve display status from unified creator row (falls back to never). */
export function resolveCreatorEnrichmentStatus(
  status: CreatorEnrichmentStatus | null | undefined
): CreatorEnrichmentStatus {
  return status ?? "never";
}

/** True while enrichment is queued or actively collecting. */
export function isEnrichmentInProgress(status: CreatorEnrichmentStatus): boolean {
  return status === "queued" || status === "running";
}

/** True when the displayed data is older than the 30-day freshness window. */
export function isStaleForDisplay(
  value: string | Date | null | undefined,
  now: number = Date.now()
): boolean {
  if (!value) return true;
  const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(ts)) return true;
  return now - ts >= 30 * 24 * 60 * 60 * 1000;
}
