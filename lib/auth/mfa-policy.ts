/** Roles that must complete TOTP MFA (AAL2) for privileged operations. */
export const MFA_REQUIRED_ROLE_SLUGS = new Set([
  "super_admin",
  "admin",
  "finance",
]);

export function roleRequiresMfa(roleSlug: string | null | undefined): boolean {
  return Boolean(roleSlug && MFA_REQUIRED_ROLE_SLUGS.has(roleSlug));
}

export function mfaRedirectPath(
  code: "mfa_enroll_required" | "mfa_challenge_required",
  nextPath = "/"
): string {
  const next = encodeURIComponent(nextPath.startsWith("/") ? nextPath : "/");
  if (code === "mfa_enroll_required") {
    return `/auth/mfa/enroll?next=${next}`;
  }
  return `/auth/mfa?next=${next}`;
}
