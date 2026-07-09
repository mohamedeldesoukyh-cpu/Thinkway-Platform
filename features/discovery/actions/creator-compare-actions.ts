"use server";

import { loadCreatorCompareBundle } from "@/lib/creators/creator-compare-bundle";
import { requireRequestUser } from "@/lib/supabase/server";

export async function loadCreatorCompareBundleAction(unifiedIds: string[]) {
  const { supabase } = await requireRequestUser();

  return loadCreatorCompareBundle(supabase, unifiedIds);
}
