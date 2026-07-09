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

export function isStructuredLoggingEnabled(): boolean {
  if (process.env.STRUCTURED_LOGS === "0") return false;
  if (process.env.STRUCTURED_LOGS === "1") return true;
  return process.env.NODE_ENV === "production" || isProductionEnvironment();
}
