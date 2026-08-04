/**
 * Service-role Supabase client usable from Next.js server code AND Node workers.
 *
 * Prefer this over `@/lib/supabase/admin` from discovery-worker / BullMQ paths.
 * `admin.ts` imports `server-only`, which throws outside the Next.js bundler and
 * previously caused Apify budget checks to fail closed as `usage_unverified`.
 *
 * Never import from Client Components.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceRoleClient(): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) is required.");
  }
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service-role operations.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resolve a service-role client, or null with a diagnostic reason (never throw). */
export function tryCreateServiceRoleClient(): {
  client: SupabaseClient | null;
  reason: string | null;
} {
  try {
    return { client: createServiceRoleClient(), reason: null };
  } catch (error) {
    return {
      client: null,
      reason: error instanceof Error ? error.message : "service_role_client_unavailable",
    };
  }
}
