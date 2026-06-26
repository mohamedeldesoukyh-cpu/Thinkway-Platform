import { createClient } from "@supabase/supabase-js";

import { supabaseUrl } from "@/lib/supabase/env";

/** Service-role client for cron jobs and background collectors (bypasses RLS). */
export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations.");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
