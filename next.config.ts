import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
  experimental: {
    // Middleware/proxy buffers request bodies (default 10 MB). Truncation breaks multipart
    // server-action uploads with "Unexpected end of form" before bodySizeLimit applies.
    proxyClientMaxBodySize: "50mb",
    serverActions: {
      // Creator import uploads allow up to 50 MB (see CREATOR_IMPORT_MAX_BYTES).
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
