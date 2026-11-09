"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { QUOTATION_PERMISSIONS } from "./constants";
import { validateDeliverableFavorites, type DeliverableFavorite } from "./deliverable-favorites";

async function actor() {
  const supabase = await createSupabaseServerClient();
  let auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
  if ("error" in auth) throw new Error(auth.error);
  return { supabase: supabase as SupabaseClient, userId: auth.userId };
}

export async function loadDeliverableFavorites(): Promise<{ ok: true; favorites: DeliverableFavorite[] } | { ok: false; message: string }> {
  try {
    const { supabase, userId } = await actor();
    const { data, error } = await supabase.from("quotation_deliverable_favorites").select("favorites").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return { ok: true, favorites: validateDeliverableFavorites(data?.favorites ?? []) };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not load favorites." }; }
}

export async function saveDeliverableFavorites(input: unknown): Promise<{ ok: true; favorites: DeliverableFavorite[] } | { ok: false; message: string }> {
  try {
    const favorites = validateDeliverableFavorites(input);
    const { supabase, userId } = await actor();
    const { error } = await supabase.from("quotation_deliverable_favorites").upsert({ user_id: userId, favorites, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { ok: true, favorites };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not save favorites." }; }
}
