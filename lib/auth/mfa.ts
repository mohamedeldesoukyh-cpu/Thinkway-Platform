import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { roleRequiresMfa } from "@/lib/auth/mfa-policy";

export type PrivilegedMfaResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      code: "mfa_enroll_required" | "mfa_challenge_required";
    };

/**
 * Ensure privileged roles are at AAL2 (TOTP verified for this session).
 * Non-privileged roles always pass.
 */
export async function ensurePrivilegedAal2(
  supabase: SupabaseClient,
  roleSlug: string | null | undefined
): Promise<PrivilegedMfaResult> {
  if (!roleRequiresMfa(roleSlug)) {
    return { ok: true };
  }

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError) {
    return {
      ok: false,
      error: aalError.message || "Unable to verify multi-factor authentication.",
      code: "mfa_challenge_required",
    };
  }

  if (aal?.currentLevel === "aal2") {
    return { ok: true };
  }

  const { data: factors, error: factorsError } =
    await supabase.auth.mfa.listFactors();

  if (factorsError) {
    return {
      ok: false,
      error: factorsError.message || "Unable to list MFA factors.",
      code: "mfa_challenge_required",
    };
  }

  const hasVerifiedTotp =
    factors?.totp?.some((factor) => factor.status === "verified") ?? false;

  if (!hasVerifiedTotp) {
    return {
      ok: false,
      error:
        "Multi-factor authentication enrollment is required for your role.",
      code: "mfa_enroll_required",
    };
  }

  return {
    ok: false,
    error: "Multi-factor authentication verification is required.",
    code: "mfa_challenge_required",
  };
}

export { MFA_REQUIRED_ROLE_SLUGS, mfaRedirectPath, roleRequiresMfa } from "@/lib/auth/mfa-policy";
