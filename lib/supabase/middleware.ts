import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  authorizeCronRequest,
  isApiPath,
  isCronPath,
  isPublicPath,
  sanitizeNextPath,
} from "@/lib/auth/routes";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

function copyResponseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const pathname = request.nextUrl.pathname;

  // Do not add logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    if (isCronPath(pathname) && authorizeCronRequest(request)) {
      return supabaseResponse;
    }

    if (isApiPath(pathname)) {
      const unauthorized = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
      copyResponseCookies(supabaseResponse, unauthorized);
      return unauthorized;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const nextPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", nextPath);
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyResponseCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  if (user && pathname === "/login") {
    const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
    const redirectResponse = NextResponse.redirect(new URL(next, request.url));
    copyResponseCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  return supabaseResponse;
}
