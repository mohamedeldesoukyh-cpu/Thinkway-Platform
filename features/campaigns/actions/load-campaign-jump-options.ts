"use server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CampaignJumpOption = {
  id: string;
  document_number: string | null;
  name: string;
};

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

/**
 * Campaign Workspace jump dropdown — Camp Code + Name options.
 * Self-contained action (no heavy service imports) so the client always gets a reliable payload.
 */
export async function loadCampaignJumpOptionsAction(input?: {
  search?: string;
  ids?: string[];
  limit?: number;
}): Promise<
  { ok: true; options: CampaignJumpOption[] } | { ok: false; message: string }
> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.read");
  if ("error" in auth) return { ok: false, message: auth.error };

  try {
    const limit = Math.min(Math.max(input?.limit ?? 2000, 1), 5000);
    const ids = (input?.ids ?? []).map((id) => id.trim()).filter(Boolean);
    const search = input?.search?.trim() ?? "";

    let query = supabase
      .from("campaign_headers")
      .select("id, document_number, name")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (ids.length > 0) {
      query = query.in("id", ids.slice(0, limit));
    } else if (search) {
      const pattern = `%${escapeIlikePattern(search)}%`;
      query = query.or(
        [`name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
      );
    }

    const { data, error } = await query;
    if (error) return { ok: false, message: error.message };

    const options = ((data ?? []) as Array<{
      id: string;
      document_number: string | null;
      name: string | null;
    }>).map((row) => ({
      id: row.id,
      document_number: row.document_number?.trim() || null,
      name: row.name?.trim() || "Untitled campaign",
    }));

    return { ok: true, options };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Failed to load campaign jump list.",
    };
  }
}
