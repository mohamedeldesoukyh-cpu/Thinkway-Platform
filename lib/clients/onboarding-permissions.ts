import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthContext } from "@/lib/auth/permissions-server";
import { hasPermission } from "@/lib/auth/permissions";

/**
 * Roles allowed to manually override onboarding status.
 * Director / Commercial Director map to admin and account_manager (no director slug in DB).
 */
export const ONBOARDING_OVERRIDE_ROLE_SLUGS = new Set([
  "super_admin",
  "admin",
  "finance",
  "account_manager",
]);

export function canOverrideOnboardingStatus(roleSlug: string | null): boolean {
  return Boolean(roleSlug && ONBOARDING_OVERRIDE_ROLE_SLUGS.has(roleSlug));
}

export async function requireOnboardingChecklistAccess(
  supabase: SupabaseClient
): Promise<{ userId: string; roleSlug: string | null } | { error: string }> {
  const ctx = await getAuthContext(supabase);
  if (!ctx.userId) {
    return { error: ctx.error ?? "Unauthorized" };
  }

  const allowed =
    ctx.roleSlug === "super_admin" ||
    ctx.roleSlug === "admin" ||
    (await hasPermission(supabase, "clients.write"));

  if (!allowed) {
    return { error: "You do not have permission to update client onboarding." };
  }

  return { userId: ctx.userId, roleSlug: ctx.roleSlug };
}

export async function requireOnboardingOverrideAccess(
  supabase: SupabaseClient
): Promise<{ userId: string; roleSlug: string | null } | { error: string }> {
  const ctx = await getAuthContext(supabase);
  if (!ctx.userId) {
    return { error: ctx.error ?? "Unauthorized" };
  }

  if (!canOverrideOnboardingStatus(ctx.roleSlug)) {
    return {
      error: "Admin, Director, Finance, or Commercial Director access required.",
    };
  }

  return { userId: ctx.userId, roleSlug: ctx.roleSlug };
}
