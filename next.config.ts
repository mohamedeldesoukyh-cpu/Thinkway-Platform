import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

import { resolveServerActionAllowedOrigins } from "./lib/security/server-action-origins";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/**
 * Build-time release metadata for client + server (never hardcoded in UI).
 * Version comes from npm's package env when running via `npm run build` / Vercel.
 */
const releaseEnv = {
  NEXT_PUBLIC_APP_VERSION:
    process.env.npm_package_version?.trim() ||
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    "0.0.0",
  NEXT_PUBLIC_GIT_SHA:
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    process.env.GIT_SHA?.trim() ||
    "",
  // CLI `vercel deploy` sets VERCEL_DEPLOYMENT_ID even when git SHA is absent.
  NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID:
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID?.trim() ||
    "",
  NEXT_PUBLIC_BUILD_TIMESTAMP:
    process.env.BUILD_TIMESTAMP?.trim() ||
    process.env.NEXT_PUBLIC_BUILD_TIMESTAMP?.trim() ||
    new Date().toISOString(),
  NEXT_PUBLIC_VERCEL_ENV:
    process.env.VERCEL_ENV?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ||
    "development",
};

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  // CSP also applied in proxy for API nuance; keep a compatible document CSP here.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://*.openai.com",
      "frame-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  env: releaseEnv,
  // Pre-existing type debt outside Phase 3 scope can block bundle measurement.
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPECHECK === "true",
  },
  serverExternalPackages: [
    "puppeteer-core",
    "@sparticuz/chromium-min",
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "sharp",
    // Do NOT externalize sanitize-html: its htmlparser2@12 dependency is ESM-only.
    // Turbopack externalRequire() then throws ERR_REQUIRE_ESM and crashes campaign
    // Server Actions (Assignments tab) with a Server Components digest error.
  ],
  // Tree-shake barrel imports on critical client paths (sidebar, discovery, sheets).
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "sonner",
      "@tanstack/react-virtual",
      "radix-ui",
      "class-variance-authority",
    ],
    // Middleware/proxy buffers request bodies (default 10 MB). Truncation breaks multipart
    // server-action uploads with "Unexpected end of form" before bodySizeLimit applies.
    proxyClientMaxBodySize: "50mb",
    serverActions: {
      // Creator import uploads allow up to 50 MB (see CREATOR_IMPORT_MAX_BYTES).
      bodySizeLimit: "50mb",
      // Include *.vercel.app so Preview unique URL vs git-branch alias Host/Origin
      // mismatches do not abort login / MFA Server Actions.
      allowedOrigins: resolveServerActionAllowedOrigins(),
    },
  },
  async headers() {
    // Platform-wide DENY / frame-ancestors 'none'. Preview HTML responses that
    // still need same-origin framing set SAMEORIGIN on the Response itself
    // (see EMBEDDABLE_DOCUMENT_FRAME_HEADERS) — never widen framing here.
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
