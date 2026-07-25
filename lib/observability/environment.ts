/** Canonical Thinkway deployment environment name. */
export function getThinkwayEnvironment(): string {
  return (
    process.env.THINKWAY_ENV?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV ||
    "local"
  );
}

export function isProductionEnvironment(): boolean {
  const env = getThinkwayEnvironment();
  return env === "production" || env === "prod";
}

/**
 * True when this process is a developer machine / local Next.js,
 * not a Vercel production or preview deployment.
 */
export function isLocalDevelopmentRuntime(): boolean {
  const thinkway = process.env.THINKWAY_ENV?.trim().toLowerCase();
  if (thinkway === "production" || thinkway === "prod" || thinkway === "staging") {
    return false;
  }
  if (thinkway === "local" || thinkway === "development" || thinkway === "dev") {
    return true;
  }

  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv === "production" || vercelEnv === "preview") {
    return false;
  }
  if (vercelEnv === "development") {
    return true;
  }

  // Outside Vercel (no VERCEL_ENV), treat as local even if NODE_ENV=production (next start).
  return process.env.VERCEL !== "1" && !vercelEnv;
}

export function isStructuredLoggingEnabled(): boolean {
  if (process.env.STRUCTURED_LOGS === "0") return false;
  if (process.env.STRUCTURED_LOGS === "1") return true;
  return process.env.NODE_ENV === "production" || isProductionEnvironment();
}
