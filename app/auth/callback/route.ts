import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/routes";
import {
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
} from "@/lib/security/cookie-options";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next") ?? "/");

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, _headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, mergeSupabaseCookieOptions(options));
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", origin));
}
