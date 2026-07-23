/**
 * Operational safety controls for runaway enrichment / acquisition incidents.
 *
 * When `DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION=true`:
 * - Automatic commercial enrichment (shortlist/campaign/detail/stale) is blocked
 * - Coverage / enterprise Apify acquisition is blocked
 * - Discovery browse behaves as DB-only
 * - Legacy discovery-enrich scheduler is paused
 *
 * Defaults to **true** (automatic paths off) so a deploy stops the runaway without
 * requiring an extra env flip. Set to `false` to re-enable automatic acquisition.
 *
 * Manual user refresh is NOT blocked by this switch (use DISABLE_CREATOR_ENRICHMENT
 * for a full master kill including manual).
 */

const TRUTHY = new Set(["true", "1", "yes", "on"]);
const FALSY = new Set(["false", "0", "no", "off"]);

/** Env flag — fail-closed for automatic Apify / enrichment after the runaway incident. */
export const DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION_ENV =
  "DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION";

function envFlag(name: string): string | undefined {
  return process.env[name]?.trim().toLowerCase();
}

function envTruthy(name: string, defaultValue: boolean): boolean {
  const value = envFlag(name);
  if (value === undefined || value === "") return defaultValue;
  if (TRUTHY.has(value)) return true;
  if (FALSY.has(value)) return false;
  return defaultValue;
}

/**
 * True when automatic enrichment and automatic acquisition must not run.
 * Defaults to **true** (automatic paths off) unless explicitly set to false.
 */
export function isAutomaticEnrichmentAndAcquisitionDisabled(): boolean {
  return envTruthy(DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION_ENV, true);
}

export const AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON =
  "Automatic enrichment and acquisition disabled (DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION=true).";

export type OperationalSafetyBlockMeta = Record<
  string,
  string | number | boolean | null | undefined
>;

/** Structured log for every blocked automatic enrichment / acquisition attempt. */
export function logBlockedAutomaticAction(
  action: string,
  reason: string = AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
  meta?: OperationalSafetyBlockMeta
): void {
  const suffix =
    meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  console.warn(`[operational-safety] blocked ${action}: ${reason}${suffix}`);
}
