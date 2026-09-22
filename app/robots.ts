import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
      // Allow only signed preview endpoints. Token checks and noindex remain.
      allow: ["/review/*/share?", "/review/*/share/*?", "/api/review/share-image?"],
    },
  };
}
