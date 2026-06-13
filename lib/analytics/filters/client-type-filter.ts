import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgencyOrDirect } from "@/types/database";

export type ClientTypeFilter = "all" | "agency" | "direct";

export function parseClientTypeFilter(value: string | undefined): ClientTypeFilter {
  if (value === "agency" || value === "direct") return value;
  return "all";
}

export function clientTypeFilterLabel(filter: ClientTypeFilter): string {
  switch (filter) {
    case "agency":
      return "Agency";
    case "direct":
      return "Direct";
    case "all":
    default:
      return "All";
  }
}

export function matchesClientType(
  agencyOrDirect: AgencyOrDirect | null,
  filter: ClientTypeFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "agency") return agencyOrDirect === "agency";
  if (filter === "direct") return agencyOrDirect === "direct";
  return true;
}

export function filterFactsByClientType<T extends { client_id: string }>(
  facts: T[],
  agencyByClient: Map<string, AgencyOrDirect | null>,
  filter: ClientTypeFilter
): T[] {
  if (filter === "all") return facts;
  return facts.filter((fact) =>
    matchesClientType(agencyByClient.get(fact.client_id) ?? null, filter)
  );
}

export async function loadClientAgencyOrDirectMap(
  supabase: SupabaseClient
): Promise<Map<string, AgencyOrDirect | null>> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, agency_or_direct")
    .neq("status", "archived")
    .limit(5000);

  if (error) throw new Error(error.message);

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      (row.agency_or_direct as AgencyOrDirect | null) ?? null,
    ])
  );
}
