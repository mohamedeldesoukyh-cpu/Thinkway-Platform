import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensurePrivilegedAal2 } from "@/lib/auth/mfa";
import { getRequestAuth } from "@/lib/supabase/server";
import {
  isPortalActor,
  resolveWorkspaceActor,
} from "@/lib/security/workspace-actor";

import { hasPermission, type PermissionCheckResult } from "@/lib/auth/permissions";

const PRIVILEGED_OVERRIDE_ROLES = new Set([
  "super_admin",
  "admin",
  "finance",
]);

/** Permissions that portal actors may use (client / creator workspaces). */
const PORTAL_ALLOWED_PERMISSIONS = new Set([
  "client_portal.read",
  "client_portal.write",
  "client_portal.approve",
  "creator_portal.read",
  "creator_portal.write",
  "creator_portal.approve",
]);

export async function getAuthContext(
  _supabase: SupabaseClient
): Promise<PermissionCheckResult & { userId: string | null }> {
  const { user, roleSlug, error } = await getRequestAuth();

  if (error || !user) {
    return { allowed: false, userId: null, roleSlug: null, error: "Unauthorized" };
  }

  return { allowed: true, userId: user.id, roleSlug };
}

async function withPrivilegedMfa(
  supabase: SupabaseClient,
  roleSlug: string | null,
  result: { userId: string; roleSlug: string | null }
): Promise<{ userId: string; roleSlug: string | null } | { error: string }> {
  const mfa = await ensurePrivilegedAal2(supabase, roleSlug);
  if (!mfa.ok) {
    return { error: mfa.error };
  }
  return result;
}

export async function requirePermission(
  supabase: SupabaseClient,
  permission: string
): Promise<{ userId: string; roleSlug: string | null } | { error: string }> {
  const ctx = await getAuthContext(supabase);
  if (!ctx.userId) {
    return { error: ctx.error ?? "Unauthorized" };
  }

  // P4: portal actors cannot invoke internal permissions even if a role
  // matrix is misconfigured to grant finance/ops/admin capabilities.
  if (!PORTAL_ALLOWED_PERMISSIONS.has(permission)) {
    const actor = await resolveWorkspaceActor(supabase, ctx.userId);
    if (isPortalActor(actor.kind)) {
      return {
        error:
          "Portal users cannot perform internal workspace actions. Isolation boundary.",
      };
    }
  }

  const allowed =
    ctx.roleSlug === "super_admin" ||
    ctx.roleSlug === "admin" ||
    (await hasPermission(supabase, permission));

  if (!allowed) {
    return { error: "You do not have permission to perform this action." };
  }

  return withPrivilegedMfa(supabase, ctx.roleSlug, {
    userId: ctx.userId,
    roleSlug: ctx.roleSlug,
  });
}

export async function requireFinanceOverrideAccess(
  supabase: SupabaseClient
): Promise<{ userId: string; roleSlug: string | null } | { error: string }> {
  const ctx = await getAuthContext(supabase);
  if (!ctx.userId) {
    return { error: ctx.error ?? "Unauthorized" };
  }

  const allowed =
    (ctx.roleSlug && PRIVILEGED_OVERRIDE_ROLES.has(ctx.roleSlug)) ||
    (await hasPermission(supabase, "finance.override"));

  if (!allowed) {
    return {
      error: "Finance Director, CFO, or Super Admin access required for overrides.",
    };
  }

  return withPrivilegedMfa(supabase, ctx.roleSlug, {
    userId: ctx.userId,
    roleSlug: ctx.roleSlug,
  });
}

/**
 * App-layer finance gate aligned with P0 RLS helpers.
 * - finance.read: preview / register reads
 * - finance.write: mutations (also accepts override)
 * - finance.override: privileged finance mutations
 * Admin / super_admin bypass via requirePermission.
 */
export async function requireFinancePermission(
  supabase: SupabaseClient,
  permission: "finance.read" | "finance.write" | "finance.override"
): Promise<{ userId: string; roleSlug: string | null } | { error: string }> {
  if (permission === "finance.override") {
    return requireFinanceOverrideAccess(supabase);
  }

  if (permission === "finance.write") {
    const ctx = await getAuthContext(supabase);
    if (!ctx.userId) {
      return { error: ctx.error ?? "Unauthorized" };
    }

    if (ctx.roleSlug === "super_admin" || ctx.roleSlug === "admin") {
      return withPrivilegedMfa(supabase, ctx.roleSlug, {
        userId: ctx.userId,
        roleSlug: ctx.roleSlug,
      });
    }

    if (ctx.roleSlug && PRIVILEGED_OVERRIDE_ROLES.has(ctx.roleSlug)) {
      return withPrivilegedMfa(supabase, ctx.roleSlug, {
        userId: ctx.userId,
        roleSlug: ctx.roleSlug,
      });
    }

    const allowed =
      (await hasPermission(supabase, "finance.write")) ||
      (await hasPermission(supabase, "finance.override"));

    if (!allowed) {
      return { error: "You do not have permission to perform this finance action." };
    }

    return withPrivilegedMfa(supabase, ctx.roleSlug, {
      userId: ctx.userId,
      roleSlug: ctx.roleSlug,
    });
  }

  return requirePermission(supabase, "finance.read");
}

export async function requireOperationsAccess(
  supabase: SupabaseClient
): Promise<{ userId: string; roleSlug: string | null } | { error: string }> {
  return requirePermission(supabase, "operations.write");
}
