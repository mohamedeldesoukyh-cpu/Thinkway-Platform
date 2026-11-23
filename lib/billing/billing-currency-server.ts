import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
export async function loadCurrencyRates(supabase: SupabaseClient, currencies: string[]): Promise<Record<string, number>> {
  return Object.fromEntries(await Promise.all([...new Set(currencies)].map(async currency =>
    [currency, await resolveRateToEgp(supabase, currency)] as const)));
}

/** Request-local: coalesce identical FX lookups across campaign workers, never across users/loads. */
export function createCurrencyRateLoader(supabase: SupabaseClient) {
  const pending = new Map<string, Promise<number>>();
  return async (currencies: string[]): Promise<Record<string, number>> =>
    Object.fromEntries(await Promise.all([...new Set(currencies)].map(async currency => {
      const code = (currency || "EGP").toUpperCase();
      let rate = pending.get(code);
      if (!rate) {
        rate = resolveRateToEgp(supabase, code);
        pending.set(code, rate);
      }
      return [currency, await rate] as const;
    })));
}
