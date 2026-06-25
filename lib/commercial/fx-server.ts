import type { SupabaseClient } from "@supabase/supabase-js";

import { REPORTING_CURRENCY } from "@/lib/commercial/fx-aggregation";

/**
 * Resolve a FX rate from `currency` → EGP using the existing platform RPC
 * `resolve_effective_exchange_rate`. Returns 1 for EGP or when no active rate
 * exists (safe identity fallback so totals never zero out).
 */
export async function resolveRateToEgp(
  supabase: SupabaseClient,
  currency: string
): Promise<number> {
  const code = (currency || REPORTING_CURRENCY).toUpperCase();
  if (code === REPORTING_CURRENCY) return 1;
  const { data, error } = await supabase.rpc("resolve_effective_exchange_rate", {
    p_from_currency: code,
    p_to_currency: REPORTING_CURRENCY,
  });
  if (error) return 1;
  const rate = Number(data);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}
