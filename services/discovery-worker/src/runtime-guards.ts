/**
 * Fail-fast environment guards. Must run before any BullMQ workers start.
 */

const PROD_SUPABASE_REF = "ienowhwfyxoqtzbgltno";
const DEV_SUPABASE_REF = "hsxrewjcbvmbkqdlzjhs";
const DEV_UPSTASH_HOST = "saved-opossum-86561.upstash.io";

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function supabaseRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1] ?? null;
}

function jwtRef(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    ) as { ref?: string };
    return json.ref ?? null;
  } catch {
    return null;
  }
}

function redisHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.replace(/^rediss?:/i, "https:")).hostname;
  } catch {
    return null;
  }
}

function fail(message: string): never {
  console.error(`[discovery-worker] STARTUP ABORT — ${message}`);
  console.error(
    "[discovery-worker] Refusing to start workers / consume queues until environment is corrected.",
  );
  process.exit(1);
}

/**
 * Validate THINKWAY_ENV-specific bindings. Exits process on failure.
 * Safe to call when THINKWAY_ENV is unset (local) — only enforces when set.
 */
export function assertWorkerRuntimeGuards(): void {
  const thinkwayEnv = firstEnv("THINKWAY_ENV", "NEXT_PUBLIC_THINKWAY_ENV")?.toLowerCase();
  const supabaseUrl = firstEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = firstEnv("SUPABASE_SERVICE_ROLE_KEY");
  const redisUrl = firstEnv("REDIS_URL");
  const urlRef = supabaseRefFromUrl(supabaseUrl);
  const keyRef = jwtRef(serviceRole);
  const host = redisHost(redisUrl);
  const expectedRef = firstEnv("EXPECTED_SUPABASE_PROJECT_REF");
  const expectedRedisHost = firstEnv("EXPECTED_REDIS_HOST");

  if (!thinkwayEnv) {
    console.warn(
      "[discovery-worker] THINKWAY_ENV unset — skipping production/development fail-fast guards (local mode).",
    );
    return;
  }

  if (thinkwayEnv === "production" || thinkwayEnv === "prod") {
    if (expectedRef && expectedRef !== PROD_SUPABASE_REF) {
      fail(
        `EXPECTED_SUPABASE_PROJECT_REF=${expectedRef} is not Production (${PROD_SUPABASE_REF})`,
      );
    }
    if (urlRef !== PROD_SUPABASE_REF) {
      fail(
        `Supabase URL ref is "${urlRef ?? "missing"}"; Production requires "${PROD_SUPABASE_REF}"`,
      );
    }
    if (keyRef !== PROD_SUPABASE_REF) {
      fail(
        `SUPABASE_SERVICE_ROLE_KEY JWT ref is "${keyRef ?? "missing"}"; Production requires "${PROD_SUPABASE_REF}"`,
      );
    }
    if (!host || /localhost|127\.0\.0\.1/i.test(host)) {
      fail("Production REDIS_URL must be a managed host (not localhost)");
    }
    if (host === DEV_UPSTASH_HOST) {
      fail(`Production REDIS_URL points at Development Upstash host (${DEV_UPSTASH_HOST})`);
    }
    if (urlRef === DEV_SUPABASE_REF || keyRef === DEV_SUPABASE_REF) {
      fail("Production worker must not use Development Supabase");
    }
    if (expectedRedisHost && host !== expectedRedisHost) {
      fail(
        `REDIS_URL host "${host}" does not match EXPECTED_REDIS_HOST "${expectedRedisHost}"`,
      );
    }
    if (!expectedRedisHost) {
      fail(
        "EXPECTED_REDIS_HOST is required when THINKWAY_ENV=production (set to Vercel Production Redis host)",
      );
    }
    console.log(
      `[discovery-worker] Production runtime guards OK (supabase=${urlRef}, redis=${host})`,
    );
    return;
  }

  if (
    thinkwayEnv === "development" ||
    thinkwayEnv === "dev" ||
    thinkwayEnv === "preview"
  ) {
    if (expectedRef && expectedRef !== DEV_SUPABASE_REF) {
      fail(
        `EXPECTED_SUPABASE_PROJECT_REF=${expectedRef} is not Development (${DEV_SUPABASE_REF})`,
      );
    }
    if (urlRef && urlRef !== DEV_SUPABASE_REF) {
      fail(
        `Supabase URL ref is "${urlRef}"; Development requires "${DEV_SUPABASE_REF}"`,
      );
    }
    if (keyRef && keyRef !== DEV_SUPABASE_REF) {
      fail(
        `SUPABASE_SERVICE_ROLE_KEY JWT ref is "${keyRef}"; Development requires "${DEV_SUPABASE_REF}"`,
      );
    }
    if (urlRef === PROD_SUPABASE_REF || keyRef === PROD_SUPABASE_REF) {
      fail("Development worker must not use Production Supabase");
    }
    if (expectedRedisHost && host && host !== expectedRedisHost) {
      fail(
        `REDIS_URL host "${host}" does not match EXPECTED_REDIS_HOST "${expectedRedisHost}"`,
      );
    }
    console.log(
      `[discovery-worker] Development runtime guards OK (supabase=${urlRef ?? "n/a"}, redis=${host ?? "n/a"})`,
    );
    return;
  }

  console.warn(
    `[discovery-worker] Unknown THINKWAY_ENV="${thinkwayEnv}" — no strict guards applied`,
  );
}
