import "./load-env.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export const config = {
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  headless: process.env.DISCOVERY_HEADLESS !== "false",
  minDelayMs: Number(process.env.DISCOVERY_MIN_DELAY_MS ?? 2000),
  maxDelayMs: Number(process.env.DISCOVERY_MAX_DELAY_MS ?? 8000),
  proxyUrls: (process.env.DISCOVERY_PROXY_URLS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
  userAgent:
    process.env.DISCOVERY_USER_AGENT ??
    "Mozilla/5.0 (compatible; ThinkwayDiscovery/1.0)",
  /** Mock creator fallback permanently disabled in every environment. */
  mockSeedFallback: false,
};
