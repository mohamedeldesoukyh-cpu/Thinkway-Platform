export type SupabaseCookieOptions = {
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  domain?: string;
  maxAge?: number;
  name?: string;
};

/**
 * Supabase Auth cookie defaults (P3).
 *
 * HttpOnly MUST remain false for `@supabase/ssr` `createBrowserClient`
 * compatibility (session is read from document cookies on the client).
 * Secure + SameSite are enforced; Secure is required in production.
 */
export function getSupabaseCookieOptions(): SupabaseCookieOptions {
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

/** Merge library cookie options with hardened defaults. */
export function mergeSupabaseCookieOptions(
  options?: Partial<SupabaseCookieOptions> | null
): SupabaseCookieOptions {
  return {
    ...getSupabaseCookieOptions(),
    ...options,
    path: options?.path ?? "/",
    sameSite: options?.sameSite ?? "lax",
    secure: options?.secure ?? process.env.NODE_ENV === "production",
    httpOnly: false,
  };
}
