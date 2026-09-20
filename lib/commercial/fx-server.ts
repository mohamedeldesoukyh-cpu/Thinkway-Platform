import type { SupabaseClient } from "@supabase/supabase-js";

import { REPORTING_CURRENCY } from "@/lib/commercial/fx-aggregation";

/**
 * Resolve a FX rate from `currency` → EGP using the existing platform RPC
 * `resolve_effective_exchange_rate` (direct, inverse, then USD triangulation).
 * Returns 1 only for EGP. Missing rates and lookup failures are explicit errors.
 */
export async function resolveRateToEgp(
  supabase: SupabaseClient,
  currency: string,
  asOf?: string | null
): Promise<number> {
  const code = (currency || REPORTING_CURRENCY).toUpperCase();
  if (code === REPORTING_CURRENCY) return 1;
  const payload: {
    p_from_currency: string;
    p_to_currency: string;
    p_as_of?: string;
  } = {
    p_from_currency: code,
    p_to_currency: REPORTING_CURRENCY,
  };
  const asOfDate = asOf?.trim().slice(0, 10);
  if (asOfDate) payload.p_as_of = asOfDate;
  const { data, error } = await supabase.rpc(
    "resolve_effective_exchange_rate",
    payload
  );
  if (error) throw new Error(`Cannot resolve ${code} → EGP: ${error.message}`);
  const rate = Number(data);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Missing FX rate: ${code} → EGP`);
  return rate;
}
