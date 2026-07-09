"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { hydrateCreatorsFromDna } from "../services/creator-hydration-service";
import type { HydratedVendor, HydrationMapperOptions } from "@/features/campaign-studio/services/creator-hydration-mapper";

export async function hydrateCreatorsFromDnaAction(
  creatorIds: string[],
  rationale?: string,
  avgFitScore?: number,
  options?: HydrationMapperOptions
): Promise<{ vendors: HydratedVendor[]; loading: false }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { vendors: [], loading: false };
  }

  const { vendors } = await hydrateCreatorsFromDna(supabase, creatorIds, {
    rationale,
    avgFitScore,
    ...options,
  });

  return { vendors, loading: false };
}
