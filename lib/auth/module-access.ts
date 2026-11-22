import type { SupabaseClient } from "@supabase/supabase-js";

export type ModuleAccess = { media: boolean; accounting: boolean; manage: boolean; admin: boolean };
export const NO_MODULES: ModuleAccess = { media: false, accounting: false, manage: false, admin: false };

export async function loadModuleAccess(db: SupabaseClient): Promise<ModuleAccess> {
  const { data, error } = await db.rpc("tw_module_access");
  if (error) throw new Error("Module access could not be verified. Please retry.");
  if (!data || typeof data !== "object") return NO_MODULES;
  return { media: data.media === true, accounting: data.accounting === true, manage: data.manage === true, admin: data.admin === true };
}

export function moduleHome(access: ModuleAccess): string {
  if (access.media && access.accounting) return "/modules";
  if (access.accounting) return "/accounting";
  if (access.media) return "/media";
  return "/modules";
}

export function isAccountingPath(path: string): boolean {
  return path === "/accounting" || path.startsWith("/accounting/") || path === "/api/accounting" || path.startsWith("/api/accounting/");
}
