/**
 * Creator-level enrichment status from orchestration row + per-platform states.
 *
 * Prevents incorrect downgrades (e.g. IG enriched + TikTok never → Queued) and
 * reconciles orphaned queued/running rows when no BullMQ job is in flight.
 */

import type { CreatorEnrichmentStatus } from "./types";

export type CreatorStatusResolutionInput = {
  creatorId: string;
  storedStatus: CreatorEnrichmentStatus | null | undefined;
  platformStatuses: Array<CreatorEnrichmentStatus | null | undefined>;
  /** True when a BullMQ job for this creator is waiting or active. */
  hasInflightJob?: boolean;
  /** Emit `[status]` diagnostic log. Default true. */
  log?: boolean;
};

const PROCESSING: CreatorEnrichmentStatus[] = ["queued", "running"];
const COMPLETED: CreatorEnrichmentStatus[] = ["enriched", "partial", "skipped"];

function isProcessing(status: CreatorEnrichmentStatus): boolean {
  return PROCESSING.includes(status);
}

function isCompleted(status: CreatorEnrichmentStatus): boolean {
  return COMPLETED.includes(status);
}

/**
 * Resolve display/poll status for a creator.
 *
 * Rules:
 * - Any in-flight job or active processing → queued/running (Updating in UI)
 * - Orphaned queued/running without a job → fall through (never stick on Queued)
 * - All platforms never → never
 * - Any failure with some success → partial
 * - Any failure with no success → failed
 * - Any platform completed (mixed with never is OK) → enriched
 */
export function resolveAggregatedCreatorEnrichmentStatus(
  input: CreatorStatusResolutionInput
): CreatorEnrichmentStatus {
  const stored = input.storedStatus ?? "never";
  const platformStatuses = input.platformStatuses.map((status) => status ?? "never");
  const hasInflightJob = Boolean(input.hasInflightJob);

  let resolved: CreatorEnrichmentStatus;

  if (hasInflightJob) {
    if (
      stored === "running" ||
      platformStatuses.some((status) => status === "running")
    ) {
      resolved = "running";
    } else {
      resolved = "queued";
    }
  } else if (isProcessing(stored)) {
    // Orphaned orchestration row — reconcile from platform terminal states.
    resolved = resolveTerminalFromPlatforms(platformStatuses, stored);
  } else if (platformStatuses.some((status) => isProcessing(status))) {
    // Platform row stuck processing without a job — treat as terminal mix.
    resolved = resolveTerminalFromPlatforms(platformStatuses, stored);
  } else if (platformStatuses.length === 0) {
    resolved = isProcessing(stored) ? resolveTerminalFromPlatforms([], stored) : stored;
  } else {
    resolved = resolveTerminalFromPlatforms(platformStatuses, stored);
  }

  if (input.log !== false) {
    console.log(
      `[status] creatorId=${input.creatorId} platformStatuses=${JSON.stringify(platformStatuses)} resolvedStatus=${resolved}`
    );
  }

  return resolved;
}

function resolveTerminalFromPlatforms(
  platformStatuses: CreatorEnrichmentStatus[],
  stored: CreatorEnrichmentStatus
): CreatorEnrichmentStatus {
  const terminals = platformStatuses.filter(
    (status) => !isProcessing(status)
  );

  if (terminals.length === 0) {
    if (isCompleted(stored) || stored === "failed") return stored;
    return "never";
  }

  const allNever = terminals.every((status) => status === "never");
  if (allNever) {
    if (isProcessing(stored)) return "never";
    return stored === "never" ? "never" : stored;
  }

  const anyFailed = terminals.some((status) => status === "failed");
  const anyCompleted = terminals.some((status) => isCompleted(status));

  if (anyFailed && anyCompleted) return "partial";
  if (anyFailed) return "failed";
  if (anyCompleted) return "enriched";

  if (isCompleted(stored) || stored === "failed") return stored;
  return "never";
}
