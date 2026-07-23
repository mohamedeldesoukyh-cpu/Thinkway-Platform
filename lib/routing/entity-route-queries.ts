import { createSupabaseServerClient } from "@/lib/supabase/server";

import { slugifyDisplayName } from "./entity-slug";
import { resolveEntityIdByRouteKey } from "./resolve-entity-route";

async function supabase() {
  return createSupabaseServerClient();
}

export async function resolveCampaignIdByRouteKey(routeKey: string): Promise<string | null> {
  return resolveEntityIdByRouteKey(await supabase(), "campaign_headers", routeKey);
}

export async function resolveClientIdByRouteKey(routeKey: string): Promise<string | null> {
  return resolveEntityIdByRouteKey(await supabase(), "clients", routeKey);
}

export async function resolveVendorIdByRouteKey(routeKey: string): Promise<string | null> {
  const client = await supabase();
  return resolveEntityIdByRouteKey(client, "influencers", routeKey, {
    nameColumn: "display_name",
  });
}

export async function resolveGroupIdByRouteKey(routeKey: string): Promise<string | null> {
  return resolveEntityIdByRouteKey(await supabase(), "groups", routeKey);
}

export async function resolveShortlistIdByRouteKey(routeKey: string): Promise<string | null> {
  return resolveEntityIdByRouteKey(await supabase(), "discovery_shortlists", routeKey);
}

export async function resolveQuotationIdByRouteKey(routeKey: string): Promise<string | null> {
  return resolveEntityIdByRouteKey(await supabase(), "quotations", routeKey);
}

export type EntityRouteSummary = {
  id: string;
  slug: string | null;
  name: string;
  document_number?: string | null;
  serial_number?: string | null;
};

function withDerivedSlug(row: {
  id: string;
  name: string;
  slug?: string | null;
  document_number?: string | null;
  serial_number?: string | null;
}): EntityRouteSummary {
  return {
    id: row.id,
    slug: row.slug?.trim() || slugifyDisplayName(row.name) || null,
    name: row.name,
    document_number: row.document_number ?? null,
    serial_number: row.serial_number ?? null,
  };
}

export async function fetchCampaignRouteSummary(
  id: string
): Promise<EntityRouteSummary | null> {
  const client = await supabase();
  const { data, error } = await client
    .from("campaign_headers")
    .select("id, name, document_number")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; name: string; document_number: string };
  return withDerivedSlug(row);
}

export async function fetchClientRouteSummary(
  id: string
): Promise<EntityRouteSummary | null> {
  const client = await supabase();
  const { data, error } = await client
    .from("clients")
    .select("id, name, document_number")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; name: string; document_number: string | null };
  return withDerivedSlug(row);
}

export async function fetchVendorRouteSummary(
  id: string
): Promise<EntityRouteSummary | null> {
  const client = await supabase();
  const { data, error } = await client
    .from("influencers")
    .select("id, display_name, document_number")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    id: string;
    display_name: string;
    document_number: string | null;
  };
  return withDerivedSlug({
    id: row.id,
    name: row.display_name,
    document_number: row.document_number,
  });
}

export async function fetchGroupRouteSummary(
  id: string
): Promise<EntityRouteSummary | null> {
  const client = await supabase();
  const { data, error } = await client
    .from("groups")
    .select("id, name, document_number")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; name: string; document_number: string };
  return withDerivedSlug(row);
}

export async function fetchShortlistRouteSummary(
  id: string
): Promise<EntityRouteSummary | null> {
  const client = await supabase();
  const { data, error } = await client
    .from("discovery_shortlists")
    .select("id, name, serial_number, slug")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (/slug/i.test(error.message)) {
      const fallback = await client
        .from("discovery_shortlists")
        .select("id, name, serial_number")
        .eq("id", id)
        .maybeSingle();
      if (fallback.error) throw new Error(fallback.error.message);
      if (!fallback.data) return null;
      const row = fallback.data as {
        id: string;
        name: string;
        serial_number: string | null;
      };
      return withDerivedSlug({
        id: row.id,
        name: row.name,
        serial_number: row.serial_number,
      });
    }
    throw new Error(error.message);
  }
  if (!data) return null;
  const row = data as {
    id: string;
    name: string;
    serial_number: string | null;
    slug?: string | null;
  };
  return withDerivedSlug({
    id: row.id,
    name: row.name,
    slug: row.slug,
    serial_number: row.serial_number,
  });
}

export async function fetchQuotationRouteSummary(
  id: string
): Promise<EntityRouteSummary | null> {
  const client = await supabase();
  const { data, error } = await client
    .from("quotations")
    .select("id, name, serial_number")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    id: string;
    name: string;
    serial_number: string | null;
  };
  return withDerivedSlug({
    id: row.id,
    name: row.name,
    serial_number: row.serial_number,
  });
}
