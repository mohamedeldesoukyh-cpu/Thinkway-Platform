import "./load-env.js";

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.RAILWAY_SERVICE_NAME)
  );
}

type RequiredEnvSpec = {
  label: string;
  names: string[];
};

const requiredSpecs: RequiredEnvSpec[] = [
  {
    label: "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)",
    names: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
  },
  {
    label: "SUPABASE_SERVICE_ROLE_KEY",
    names: ["SUPABASE_SERVICE_ROLE_KEY"],
  },
];

if (isProductionRuntime()) {
  requiredSpecs.push({
    label: "REDIS_URL (managed Redis — not localhost)",
    names: ["REDIS_URL"],
  });
}

const missing = requiredSpecs
  .filter((spec) => !firstEnv(...spec.names))
  .map((spec) => spec.label);

if (missing.length > 0) {
  throw new Error(
    [
      "[discovery-worker] Missing required environment variables:",
      ...missing.map((label) => `  - ${label}`),
      "",
      "Set these on the Railway worker service (Vercel env is not inherited).",
      "See docs/infrastructure/WORKER_OPERATIONS.md § Required environment.",
    ].join("\n")
  );
}

const redisUrl =
  firstEnv("REDIS_URL") ??
  (isProductionRuntime() ? "" : "redis://127.0.0.1:6379");

if (
  isProductionRuntime() &&
  (/localhost|127\.0\.0\.1/i.test(redisUrl) || !redisUrl)
) {
  throw new Error(
    "[discovery-worker] REDIS_URL must be a managed Redis URL in production (not localhost)."
  );
}

export const config = {
  redisUrl,
  supabaseUrl: firstEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")!,
  supabaseServiceRoleKey: firstEnv("SUPABASE_SERVICE_ROLE_KEY")!,
  openAiApiKey: firstEnv("OPENAI_API_KEY") ?? "",
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
