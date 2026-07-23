import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

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
    },
  },
};

export default withBundleAnalyzer(nextConfig);
