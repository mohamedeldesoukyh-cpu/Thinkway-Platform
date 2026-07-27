/**
 * Creator CRM feature flags.
 *
 * Commercial CRM completion: writers and CRM-only list default ON so Vendors
 * operates as Commercial CRM. Explicit false/0/off/no disables (rollback).
 */

function envDisabled(raw: string | undefined): boolean {
  if (raw == null) return false;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized === "0" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "off"
  );
}

/**
 * When enabled (default), `/vendors` lists only commercial CRM members
 * (`has_commercial_profile`). Set env to false/0/off for legacy full inventory.
 */
export function isCreatorCrmFilterEnabled(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED ??
    process.env.CREATOR_CRM_FILTER_ENABLED;
  if (raw == null || raw.trim() === "") return true;
  return !envDisabled(raw);
}

/**
 * When enabled (default), `ensureCommercialCreator` persists CRM rows.
 * Set CREATOR_CRM_WRITERS_ENABLED=false to force dormant mode.
 */
export function isCreatorCrmWritersEnabled(): boolean {
  const raw = process.env.CREATOR_CRM_WRITERS_ENABLED;
  if (raw == null || raw.trim() === "") return true;
  return !envDisabled(raw);
}
