"use server";

import { loadCreatorCompareBundle } from "@/lib/creators/creator-compare-bundle";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loadCreatorCompareBundleAction(unifiedIds: string[]) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  return loadCreatorCompareBundle(supabase, unifiedIds);
}
