/**
 * Public origin for Client/Vendor IO approval links in outbound email.
 * Production must never emit Dev/localhost approval URLs.
 */
export function resolveIoPublicAppOrigin(
  env: NodeJS.ProcessEnv = process.env
): string {
  const strip = (value: string) => value.replace(/\/$/, "");
  const productionFallback =
    env.NEXT_PUBLIC_PRODUCTION_APP_URL?.trim() ||
    "https://app.thinkwaymedia.com";
  const developmentFallback =
    env.NEXT_PUBLIC_DEVELOPMENT_APP_URL?.trim() ||
    "https://dev.thinkwaymedia.com";
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();

  if (vercelEnv === "production") {
    // Prefer explicit production URL; reject accidental Dev/local APP_URL.
    if (configured) {
      const lower = configured.toLowerCase();
      if (
        lower.includes("app.thinkwaymedia.com") ||
        (!lower.includes("dev.thinkwaymedia.com") &&
          !lower.includes("localhost") &&
          !lower.includes("127.0.0.1"))
      ) {
        return strip(configured);
      }
    }
    return strip(productionFallback);
  }

  if (vercelEnv === "preview") {
    const vercelUrl = env.VERCEL_URL?.trim();
    if (vercelUrl) {
      return strip(
        vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`
      );
    }
  }

  if (configured) return strip(configured);
  if (vercelEnv === "development" || env.NODE_ENV === "development") {
    return strip(developmentFallback);
  }
  return strip(configured || developmentFallback || "http://localhost:3000");
}
