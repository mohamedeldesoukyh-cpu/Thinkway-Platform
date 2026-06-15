import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export function intelligenceDb(supabase: SupabaseClient<Database>) {
  return supabase.schema("intelligence");
}

export function isMissingIntelligenceTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("intelligence") &&
    (message.includes("does not exist") ||
      message.includes("Could not find the table") ||
      message.includes("schema cache"))
  );
}
