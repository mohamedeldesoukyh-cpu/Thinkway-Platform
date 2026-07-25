import type { CookieOptions, CookieOptionsWithName } from "@supabase/ssr";

/**
 * Supabase SSR cookie options (`@supabase/ssr` → `cookie` SerializeOptions).
 * Prefer this alias at call sites that configure createBrowserClient / createServerClient.
 */
export type SupabaseCookieOptions = CookieOptionsWithName;

/**
 * Supabase Auth cookie defaults (P3).
 *
 * HttpOnly MUST remain false for `@supabase/ssr` `createBrowserClient`
 * compatibility (session is read from document cookies on the client).
 * Secure + SameSite are enforced; Secure is required in production.
 */
export function getSupabaseCookieOptions(): CookieOptionsWithName {
  const isProd = process.env.NODE_ENV === "production";
  return {
    path: "/",
    sameSite: "lax",
    secure: isProd,
    // Explicit false — do not set httpOnly: true (breaks browser Supabase client).
    httpOnly: false,
  };
}

export type CookieFlagAudit = {
  sameSite: "lax";
  secure: boolean;
  httpOnly: false;
  path: "/";
  httpOnlyRationale: string;
};

export function auditSupabaseCookieFlags(): CookieFlagAudit {
  return {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
    path: "/",
    httpOnlyRationale:
      "Supabase SSR browser client requires readable auth cookies; HttpOnly would break createBrowserClient session hydration.",
  };
}

/**
 * Merge library cookie options (from setAll) with hardened defaults.
 * Accepts full `@supabase/ssr` CookieOptions, including SerializeOptions.sameSite
 * boolean values from the `cookie` package.
 */
export function mergeSupabaseCookieOptions(
  options?: CookieOptions | null
): CookieOptionsWithName {
  return {
    ...getSupabaseCookieOptions(),
    ...options,
    path: options?.path ?? "/",
    sameSite: options?.sameSite ?? "lax",
    secure: options?.secure ?? process.env.NODE_ENV === "production",
    httpOnly: false,
  };
}
