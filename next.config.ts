import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
  experimental: {
    serverActions: {
      // Creator import uploads and other multipart server actions exceed the 1 MB default.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
