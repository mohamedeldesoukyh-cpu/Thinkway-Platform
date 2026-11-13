"use server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeOverviewColumnPreferences, OVERVIEW_PREFERENCE_KEY } from "@/lib/reports/overview/overview-column-preferences";

export async function saveOverviewColumns(value: unknown) {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "analytics.read");
  if ("error" in auth) return { error: auth.error };
  const preferences = normalizeOverviewColumnPreferences(value);
  // Uses the authenticated user's session; no caller-supplied user ID.
  const { error } = await supabase.auth.updateUser({ data: { [OVERVIEW_PREFERENCE_KEY]: preferences } });
  if (error) return { error: "Could not save your selection. Please try again." };
  return { success: true };
}
