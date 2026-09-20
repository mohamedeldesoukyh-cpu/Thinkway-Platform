import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
export async function loadCurrencyRates(supabase: SupabaseClient, currencies: string[]): Promise<Record<string, number>> {
  return Object.fromEntries(await Promise.all([...new Set(currencies)].map(async currency =>
    [currency, await resolveRateToEgp(supabase, currency)] as const)));
}
