import type { SupabaseClient } from "@supabase/supabase-js";
import { COMMERCIAL_CURRENCIES } from "./fx-aggregation";
import { resolveRateToEgp } from "./fx-server";

/** Resolve each pair through FX Rates, never derive it from two EGP rates. */
export async function resolveQuotationDisplayRates(supabase: SupabaseClient, currency: string, asOf?: string | null) {
  const target = currency.toUpperCase();
  const [rate, entries] = await Promise.all([
    resolveRateToEgp(supabase, target, asOf),
    Promise.all(COMMERCIAL_CURRENCIES.map(async from => {
      if (from === target) return [from, 1] as const;
      const { data, error } = await supabase.rpc("resolve_effective_exchange_rate", {
        p_from_currency: from, p_to_currency: target, ...(asOf ? { p_as_of: asOf.slice(0, 10) } : {}),
      });
      const value = Number(data);
      if (error || !Number.isFinite(value) || value <= 0) throw new Error(`Missing FX rate: ${from} to ${target}`);
      return [from, value] as const;
    })),
  ]);
  return { rate, directRates: Object.fromEntries(entries) };
}
