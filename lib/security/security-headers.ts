/**
 * Secure default response headers (P3).
 * CSP is intentionally compatible with Next.js + Supabase + theme inline script.
 */

function buildContentSecurityPolicy(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let supabaseConnect = "https://*.supabase.co wss://*.supabase.co";
  if (supabaseUrl) {
    try {
      const origin = new URL(supabaseUrl).origin;
      supabaseConnect = `${origin} ${origin.replace("https://", "wss://")} ${supabaseConnect}`;
    } catch {
      // keep wildcard fallback
    }
  }

  const directives = [
    "default-src 'self'",
    // Next.js + theme blocking script use inline; avoid breaking App Router.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseConnect} https://api.openai.com https://*.openai.com`,
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

export type SecurityHeaderMap = Record<string, string>;

/**
 * Headers applied to HTML / app responses.
 * COEP omitted on document responses — cross-origin creator media would break.
 */
export function buildDocumentSecurityHeaders(): SecurityHeaderMap {
  return {
    "Content-Security-Policy": buildContentSecurityPolicy(),
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
  };
}

/**
 * Stricter CORP for JSON/API payloads. Still no COEP (proxied images are separate).
 */
export function buildApiSecurityHeaders(): SecurityHeaderMap {
  return {
    ...buildDocumentSecurityHeaders(),
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

export function applySecurityHeaders(
  headers: Headers,
  options?: { api?: boolean; pathname?: string }
): void {
  const map = options?.api
    ? buildApiSecurityHeaders()
    : buildDocumentSecurityHeaders();
  for (const [key, value] of Object.entries(map)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  // These responses authenticate via a signed link, not browser cookies. Social
  // previews must be readable/embeddable from outside the application origin.
  if (options?.pathname === "/api/review/share-image" ||
      /^\/review\/[0-9a-f-]{36}\/share(?:\/[^/]+)?\/?$/i.test(options?.pathname ?? "")) {
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    headers.set("Access-Control-Allow-Origin", "*");
  }
}
