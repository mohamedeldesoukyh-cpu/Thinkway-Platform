import { createSupabaseServerClient } from "@/lib/supabase/server";

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
