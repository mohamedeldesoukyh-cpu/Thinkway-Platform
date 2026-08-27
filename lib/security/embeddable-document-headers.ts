/**
 * Same-origin document embeds (quotation/shortlist preview iframes that still
 * navigate to an export URL). Overrides the global DENY / frame-ancestors none
 * policy — only for intentional HTML preview responses.
 */

export const EMBEDDABLE_DOCUMENT_FRAME_HEADERS = {
  "X-Frame-Options": "SAMEORIGIN",
  // Full CSP kept compatible with document HTML; only framing is relaxed.
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://*.openai.com",
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
} as const;
