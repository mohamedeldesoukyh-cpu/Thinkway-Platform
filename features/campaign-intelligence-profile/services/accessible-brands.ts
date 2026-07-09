import type { SupabaseClient } from "@supabase/supabase-js";

import type { BrandSelectRow } from "./build-brand-link-dialog-options";

export const BRAND_SELECT_LIMIT = 10_000;

/** All active brands the user can access — no client scoping, explicit high limit. */
export async function loadAccessibleBrandSelectRows(
  supabase: SupabaseClient
): Promise<BrandSelectRow[]> {
  const { data: brands, error: brandsError } = await supabase
    .from("brands")
    .select("id, name, client_id")
    .eq("status", "active")
    .order("name")
    .limit(BRAND_SELECT_LIMIT);

  if (brandsError) throw new Error(brandsError.message);

  const clientIds = [
    ...new Set(
      (brands ?? [])
        .map((brand) => brand.client_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const clientNameById = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", clientIds);

    if (clientsError) throw new Error(clientsError.message);

    for (const client of clients ?? []) {
      clientNameById.set(client.id, client.name);
    }
  }

  return (brands ?? []).map((brand) => ({
    id: brand.id,
    name: brand.name,
    clientId: brand.client_id,
    clientName: clientNameById.get(brand.client_id) ?? "Unknown client",
  }));
}
