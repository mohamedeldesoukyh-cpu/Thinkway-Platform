import type { SupabaseClient } from "@supabase/supabase-js";

export type VrRateLookupRow = {
  id: string;
  rate_percent: number;
  name?: string;
};

export async function fetchVrRatesByIds(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>
): Promise<Map<string, VrRateLookupRow>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("md_vr_rates")
    .select("id, name, rate_percent")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((row) => [row.id, row]));
}

export function vrRatePercentFromMap(
  map: Map<string, Pick<VrRateLookupRow, "rate_percent">>,
  vrRateId: string | null | undefined
): number | null {
  if (!vrRateId) {
    return null;
  }
  return map.get(vrRateId)?.rate_percent ?? null;
}
