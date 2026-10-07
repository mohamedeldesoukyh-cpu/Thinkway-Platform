"use server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCreatorMergeHistoryAction(influencerId: string, page = 1) {
  const id = z.uuid().parse(influencerId);
  const offset = (z.number().int().min(1).parse(page) - 1) * 20;
  const db = await createSupabaseServerClient();
  const permission = await requirePermission(db, "discovery.write");
  if ("error" in permission) throw new Error(permission.error);
  const result = await (db as SupabaseClient).from("creator_merge_history").select("id,source_table,record,created_at", { count: "exact" }).eq("influencer_id", id).order("created_at", { ascending: false }).order("id").range(offset, offset + 19);
  if (result.error) throw new Error(result.error.message);
  return { rows: (result.data ?? []) as { id: string; source_table: string; record: Record<string, unknown>; created_at: string }[], total: result.count ?? 0 };
}
