import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** @deprecated Use `createSupabaseBrowserClient()` instead. */
export const supabase = createSupabaseBrowserClient();