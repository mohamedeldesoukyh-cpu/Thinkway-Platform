import "server-only";

import { roleRequiresMfa } from "@/lib/auth/mfa-policy";
import { sanitizeNextPath } from "@/lib/auth/routes";
import { createSupabaseServerClient, getRequestAuth } from "@/lib/supabase/server";

/** Used after password sign-in to route privileged users into MFA. */
export async function resolvePostLoginMfaPath(nextPath: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { roleSlug } = await getRequestAuth();
  if (!roleRequiresMfa(roleSlug)) return null;

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") return null;

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerified =
    factors?.totp?.some((factor) => factor.status === "verified") ?? false;

  const next = encodeURIComponent(sanitizeNextPath(nextPath));
  if (!hasVerified) {
    return `/auth/mfa/enroll?next=${next}`;
  }
  return `/auth/mfa?next=${next}`;
}
