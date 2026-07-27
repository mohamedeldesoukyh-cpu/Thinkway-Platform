/**
 * Creator CRM list filter flag.
 * Phase 1: always treat as OFF unless explicitly enabled via env.
 * Default false → legacy full Vendors list (backward compatible).
 */
export function isCreatorCrmFilterEnabled(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED ??
    process.env.CREATOR_CRM_FILTER_ENABLED ??
    "false";
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}
