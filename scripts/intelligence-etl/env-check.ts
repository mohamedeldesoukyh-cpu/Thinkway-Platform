/**
 * One-off environment validation — read-only, no secrets printed.
 * Usage: npx tsx scripts/intelligence-etl/env-check.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env" });

function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as { role?: string };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

const results = {
  NEXT_PUBLIC_SUPABASE_URL: { present: !!url },
  SUPABASE_SERVICE_ROLE_KEY: {
    present: !!serviceKey,
    eyJ_prefix: serviceKey?.startsWith("eyJ") ?? false,
    role_claim: serviceKey ? decodeJwtRole(serviceKey) : null,
  },
  NOT_same_as_anon: serviceKey && anonKey ? serviceKey !== anonKey : null,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    present: !!anonKey,
    eyJ_prefix: anonKey?.startsWith("eyJ") ?? false,
    role_claim: anonKey ? decodeJwtRole(anonKey) : null,
  },
  INTELLIGENCE_EXCEL_PATH: {
    present: !!process.env.INTELLIGENCE_EXCEL_PATH?.trim(),
    uses_default: !process.env.INTELLIGENCE_EXCEL_PATH?.trim(),
  },
  INTELLIGENCE_ETL_DRY_RUN: process.env.INTELLIGENCE_ETL_DRY_RUN ?? "(unset)",
  INTELLIGENCE_ETL_TRUNCATE: process.env.INTELLIGENCE_ETL_TRUNCATE ?? "(unset)",
};

async function main() {
  console.log("=== ENV VALIDATION (no secrets) ===");
  console.log(JSON.stringify(results, null, 2));

  if (!url || !serviceKey?.startsWith("eyJ")) {
    console.log("SCHEMA_CHECK: SKIP (missing url or invalid service key)");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = supabase.schema("intelligence");

  async function headCount(table: string) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    return { table, count: count ?? null, ok: !error, error: error?.message ?? null };
  }

  const [raw, benchmarks] = await Promise.all([
    headCount("historical_campaigns_raw"),
    headCount("int_benchmarks"),
  ]);

  console.log("=== SCHEMA HEAD COUNTS (read-only) ===");
  console.log(JSON.stringify({ historical_campaigns_raw: raw, int_benchmarks: benchmarks }, null, 2));

  const serviceRoleOk =
    results.SUPABASE_SERVICE_ROLE_KEY.present &&
    results.SUPABASE_SERVICE_ROLE_KEY.eyJ_prefix &&
    results.SUPABASE_SERVICE_ROLE_KEY.role_claim === "service_role" &&
    results.NOT_same_as_anon === true;

  const schemaOk = raw.ok && benchmarks.ok;
  process.exit(serviceRoleOk && schemaOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
