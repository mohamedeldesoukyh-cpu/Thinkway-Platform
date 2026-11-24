import type { SupabaseClient } from "@supabase/supabase-js";
import { parseHiddenWorkspaceTabs } from "./tab-visibility";

export async function loadHiddenWorkspaceTabs(db: SupabaseClient, workspaceId: string) {
  return (await loadWorkspaceSettings(db, workspaceId)).hiddenTabs;
}

export async function loadWorkspaceSettings(db: SupabaseClient, workspaceId: string) {
  const { data, error } = await db.from("client_workspace_tab_settings")
    .select("hidden_tabs, refresh_limit, refresh_used, last_refresh_at").eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw new Error("Client workspace tab settings are unavailable.");
  return { hiddenTabs: parseHiddenWorkspaceTabs(data?.hidden_tabs), refreshLimit: Number(data?.refresh_limit ?? 0), refreshUsed: Number(data?.refresh_used ?? 0), lastRefreshAt: data?.last_refresh_at as string | null ?? null };
}
