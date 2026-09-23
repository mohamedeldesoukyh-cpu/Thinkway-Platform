import type { SupabaseClient } from "@supabase/supabase-js";
import { creatorFxRate } from "@/lib/commercial/creator-fx";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";

/** Freeze each assignment's negotiated conversion when the IO is generated. */
export async function clientIoFxRates(
  supabase: SupabaseClient,
  lines: { id: string; currency_code: string; revenue_fx_override?: string | null }[],
  target: string,
): Promise<Record<string, number>> {
  const rates = new Map<string, Promise<number>>();
  const rate = (code: string) => {
    if (!rates.has(code)) rates.set(code, resolveRateToEgp(supabase, code));
    return rates.get(code)!;
  };
  return Object.fromEntries(await Promise.all(lines.map(async line => [line.id,
    line.currency_code === target ? 1 : creatorFxRate({
      from: line.currency_code, to: target,
      sourceRateToEgp: await rate(line.currency_code), targetRateToEgp: await rate(target),
      override: line.revenue_fx_override,
    }),
  ])));
}
