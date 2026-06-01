import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DUPLICATE_MESSAGES,
  normalizeEntityName,
} from "@/lib/validation/hierarchy";
import type { AgencyOrDirect, Database } from "@/types/database";

type DbClient = SupabaseClient<Database>;

export async function findDuplicateGroup(
  supabase: DbClient,
  name: string,
  excludeGroupId?: string
): Promise<string | null> {
  const normalized = normalizeEntityName(name);
  if (!normalized) return "Group name is required.";

  let query = supabase
    .from("groups")
    .select("id")
    .eq("name_normalized", normalized)
    .limit(1);

  if (excludeGroupId) {
    query = query.neq("id", excludeGroupId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data?.length ? DUPLICATE_MESSAGES.group : null;
}

export async function findDuplicateClient(
  supabase: DbClient,
  name: string,
  agencyOrDirect: AgencyOrDirect,
  excludeClientId?: string
): Promise<string | null> {
  const normalized = normalizeEntityName(name);
  if (!normalized) return "Legal entity name is required.";

  let query = supabase
    .from("clients")
    .select("id")
    .eq("name_normalized", normalized)
    .eq("agency_or_direct", agencyOrDirect)
    .neq("status", "archived")
    .limit(1);

  if (excludeClientId) {
    query = query.neq("id", excludeClientId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data?.length ? DUPLICATE_MESSAGES.client : null;
}

export async function findDuplicateBrand(
  supabase: DbClient,
  name: string,
  clientId: string,
  excludeBrandId?: string
): Promise<string | null> {
  const normalized = normalizeEntityName(name);
  if (!normalized) return "Brand name is required.";
  if (!clientId) return "Select a legal entity.";

  let query = supabase
    .from("brands")
    .select("id")
    .eq("client_id", clientId)
    .eq("name_normalized", normalized)
    .neq("status", "archived")
    .limit(1);

  if (excludeBrandId) {
    query = query.neq("id", excludeBrandId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data?.length ? DUPLICATE_MESSAGES.brand : null;
}
