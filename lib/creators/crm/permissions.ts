/**
 * Convert / Create commercial creator role matrix (locked 2026-07-27).
 * Finance consumes CRM; does not convert.
 * RLS does not encode this matrix in Phase 1 — enforce in app for manual reasons.
 */

const CONVERT_ROLE_SLUGS = new Set([
  "account_manager",
  "operations",
  "admin",
  "super_admin",
]);

export function canConvertToCommercialCreator(roleSlug: string | null | undefined): boolean {
  if (!roleSlug) return false;
  return CONVERT_ROLE_SLUGS.has(roleSlug);
}

export function isManualCrmActivationReason(
  reason: string
): reason is "manual_convert" | "manual_create" {
  return reason === "manual_convert" || reason === "manual_create";
}
