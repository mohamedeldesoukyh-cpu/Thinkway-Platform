import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ExchangeRatesWorkspaceData } from "./types";

export async function getExchangeRatesWorkspace(): Promise<ExchangeRatesWorkspaceData> {
  const supabase = await createSupabaseServerClient();

  const [currenciesRes, ratesRes, historyRes, profilesRes] = await Promise.all([
    supabase
      .from("md_currencies")
      .select("code, name, symbol, decimal_places, country_code, is_active")
      .order("code"),
    supabase
      .from("md_exchange_rates")
      .select("*")
      .order("from_currency")
      .order("to_currency")
      .order("effective_start_date", { ascending: false }),
    supabase
      .from("fx_rate_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  if (currenciesRes.error) throw new Error(currenciesRes.error.message);
  if (ratesRes.error) throw new Error(ratesRes.error.message);
  if (historyRes.error) throw new Error(historyRes.error.message);

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? p.email])
  );

  return {
    currencies: (currenciesRes.data ?? []).map((row) => ({
      code: row.code,
      name: row.name,
      symbol: row.symbol,
      decimal_places: row.decimal_places ?? 2,
      country_code: row.country_code,
      is_active: row.is_active,
    })),
    rates: (ratesRes.data ?? []).map((row) => ({
      id: row.id,
      from_currency: row.from_currency,
      to_currency: row.to_currency,
      exchange_rate: Number(row.exchange_rate),
      effective_start_date: row.effective_start_date,
      effective_end_date: row.effective_end_date,
      is_active: row.is_active,
      source: row.source,
      notes: row.notes,
      created_at: row.created_at,
    })),
    fx_history: (historyRes.data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      override_reason: row.override_reason,
      recalculation_scope: row.recalculation_scope,
      impacted_record_count: row.impacted_record_count ?? 0,
      created_at: row.created_at,
      changed_by_name: row.changed_by
        ? (profileMap.get(row.changed_by) ?? null)
        : null,
      old_data: (row.old_data as Record<string, unknown>) ?? {},
      new_data: (row.new_data as Record<string, unknown>) ?? {},
    })),
  };
}

export async function resolveEffectiveExchangeRate(input: {
  from_currency: string;
  to_currency: string;
  as_of?: string;
}): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const asOf = input.as_of ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("resolve_effective_exchange_rate", {
    p_from_currency: input.from_currency.toUpperCase(),
    p_to_currency: input.to_currency.toUpperCase(),
    p_as_of: asOf,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Number(data ?? 1);
}
