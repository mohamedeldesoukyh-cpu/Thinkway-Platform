import type { SupabaseClient } from "@supabase/supabase-js";

export type PermissionCheckResult = {
  allowed: boolean;
  userId: string | null;
  roleSlug: string | null;
  error?: string;
};

const PRIVILEGED_OVERRIDE_ROLES = new Set([
  "super_admin",
  "admin",
  "finance",
]);

export async function getAuthContext(
  supabase: SupabaseClient
): Promise<PermissionCheckResult & { userId: string | null }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { allowed: false, userId: null, roleSlug: null, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role:roles(slug)")
    .eq("id", user.id)
    .maybeSingle();

  const roleSlug =
    (profile as { role: { slug: string } | null } | null)?.role?.slug ?? null;

  return { allowed: true, userId: user.id, roleSlug };
}

export async function hasPermission(
  supabase: SupabaseClient,
  permission: string
): Promise<boolean> {
  const { data, error } = await (supabase as SupabaseClient).rpc(
    "has_permission",
    { p_permission: permission }
  );

  if (error) {
    return false;
  }

  return Boolean(data);
}

export async function requirePermission(
  supabase: SupabaseClient,
  permission: string
): Promise<{ userId: string; roleSlug: string | null } | { error: string }> {
  const ctx = await getAuthContext(supabase);
  if (!ctx.userId) {
    return { error: ctx.error ?? "Unauthorized" };
  }

  const allowed =
    ctx.roleSlug === "super_admin" ||
    ctx.roleSlug === "admin" ||
    (await hasPermission(supabase, permission));

  if (!allowed) {
    return { error: "You do not have permission to perform this action." };
  }

  return { userId: ctx.userId, roleSlug: ctx.roleSlug };
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

  return { userId: ctx.userId, roleSlug: ctx.roleSlug };
}

export async function requireOperationsAccess(
  supabase: SupabaseClient
): Promise<{ userId: string; roleSlug: string | null } | { error: string }> {
  return requirePermission(supabase, "operations.write");
}
