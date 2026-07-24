/** Roles explicitly allowed to open the Operations Center. */
export const OPERATIONS_CENTER_ROLES = new Set([
  "super_admin",
  "admin",
  "operations",
  "devops",
]);

export function canAccessOperationsCenter(roleSlug: string | null): boolean {
  if (!roleSlug) return false;
  return OPERATIONS_CENTER_ROLES.has(roleSlug);
}
