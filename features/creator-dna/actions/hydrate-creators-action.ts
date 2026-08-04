"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { hydrateCreatorsFromDna } from "../services/creator-hydration-service";
import type { HydratedVendor, HydrationMapperOptions } from "@/features/campaign-studio/services/creator-hydration-mapper";

export async function hydrateCreatorsFromDnaAction(
  creatorIds: string[],
  rationale?: string,
  avgFitScore?: number,
  options?: HydrationMapperOptions & {
    includeEci?: boolean;
    includeQuotationPrices?: boolean;
  }
): Promise<{ vendors: HydratedVendor[]; loading: false }> {
  const { startServerLoadTimer } = await import("@/lib/performance/progressive-load");
  const timer = startServerLoadTimer("studio.hydrate-dna");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    timer.end({ ok: false, reason: "unauthenticated" });
    return { vendors: [], loading: false };
  }

  const { vendors } = await hydrateCreatorsFromDna(supabase, creatorIds, {
    rationale,
    avgFitScore,
    ...options,
  });

  timer.end({
    ok: true,
    count: vendors.length,
    includeEci: options?.includeEci !== false,
    includeQuotationPrices: options?.includeQuotationPrices !== false,
  });

  return { vendors, loading: false };
}
