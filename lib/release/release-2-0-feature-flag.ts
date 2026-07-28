/**
 * Release 2.0 Phase 1 — Assignment convert feature flag.
 *
 * - Explicit true/1/on/yes → enabled
 * - Explicit false/0/off/no → disabled
 * - Unset → OFF (all surfaces, including Development)
 *
 * Enable soak/Production only via explicit env:
 *   RELEASE_2_0_ASSIGNMENT_CONVERT=true
 *   (or NEXT_PUBLIC_RELEASE_2_0_ASSIGNMENT_CONVERT=true)
 */

function envFlag(raw: string | undefined): boolean | null {
  if (raw == null) return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  ) {
    return true;
  }
  if (
    normalized === "0" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "off"
  ) {
    return false;
  }
  return null;
}

/** When true, quotation convert creates Assignments (campaign_lines hierarchy). */
export function isRelease20AssignmentConvertEnabled(): boolean {
  const raw =
    process.env.RELEASE_2_0_ASSIGNMENT_CONVERT ??
    process.env.NEXT_PUBLIC_RELEASE_2_0_ASSIGNMENT_CONVERT;
  const explicit = envFlag(raw);
  if (explicit != null) return explicit;
  return false;
}
