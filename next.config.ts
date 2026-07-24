import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

function allowedServerActionOrigins(): string[] {
  const hosts = new Set<string>(["localhost:3000", "127.0.0.1:3000"]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      hosts.add(new URL(appUrl).host);
    } catch {
      // ignore
    }
  }
  for (const raw of process.env.CSRF_ALLOWED_ORIGINS?.split(",") ?? []) {
    const value = raw.trim();
    if (!value) continue;
    try {
      hosts.add(new URL(value).host);
    } catch {
      hosts.add(value.replace(/^https?:\/\//, ""));
    }
  }
  return [...hosts];
}

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
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://*.openai.com",
      "frame-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
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
    "sanitize-html",
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
      allowedOrigins: allowedServerActionOrigins(),
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
