import type { SupabaseClient } from "@supabase/supabase-js";

export type PermissionCheckResult = {
  allowed: boolean;
  userId: string | null;
  roleSlug: string | null;
  error?: string;
};

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
