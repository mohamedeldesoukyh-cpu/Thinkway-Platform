/**
 * Creator CRM feature flags.
 *
 * Filter flag: list UX (Phase 5+) — OFF → legacy full Vendors list.
 * Writers flag: allow ensureCommercialCreator to persist — OFF until workflow
 * integrations are approved (Phase 2A default).
 */

function envTruthy(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isCreatorCrmFilterEnabled(): boolean {
  return envTruthy(
    process.env.NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED ??
      process.env.CREATOR_CRM_FILTER_ENABLED
  );
}

/**
 * When false (default), `ensureCommercialCreator` is a no-op for persistence.
 * Enable only after workflow wiring is approved for an environment.
 */
export function isCreatorCrmWritersEnabled(): boolean {
  return envTruthy(process.env.CREATOR_CRM_WRITERS_ENABLED);
}
