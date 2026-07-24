"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseCookieOptions } from "@/lib/security/cookie-options";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    isSingleton: true,
    cookieOptions: getSupabaseCookieOptions(),
  });
}
