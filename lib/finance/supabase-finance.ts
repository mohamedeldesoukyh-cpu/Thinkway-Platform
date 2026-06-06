import type { SupabaseClient } from "@supabase/supabase-js";

/** Escape hatch until generated DB types include finance control tables. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FinanceControlSupabase = SupabaseClient<any, "public", any>;

export function asFinanceControlClient(
  client: SupabaseClient
): FinanceControlSupabase {
  return client as FinanceControlSupabase;
}
