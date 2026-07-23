/**
 * One-shot verification that browse_influencer_ids_by_recency is live.
 * Usage: npx tsx scripts/verify-browse-rpc.ts
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing SUPABASE URL / SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const samples: number[] = [];
  let lastError: string | null = null;
  let idCount = 0;
  let total: number | string | null = null;

  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const { data, error } = await supabase.rpc("browse_influencer_ids_by_recency", {
      p_country: null,
      p_language: null,
      p_limit: 120,
      p_offset: 0,
    });
    samples.push(Math.round(performance.now() - t0));
    if (error) {
      lastError = error.message;
      break;
    }
    idCount = data?.length ?? 0;
    total = data?.[0]?.total_count ?? null;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        callable: !lastError,
        error: lastError,
        idCount,
        total,
        latencyMs: {
          samples,
          min: sorted[0],
          p50: sorted[Math.floor(sorted.length / 2)],
          max: sorted[sorted.length - 1],
        },
        grants: {
          service_role: !lastError ? "EXECUTE ok" : "failed",
          authenticated: "granted in migration (GRANT EXECUTE TO authenticated)",
          public: "REVOKED in migration",
          anon_role: "not granted (intentional)",
        },
        rls_note:
          "SECURITY INVOKER SQL function; reads influencers/discovered_profiles under caller privileges. service_role bypasses RLS; authenticated users need SELECT on those tables (existing Discovery policies).",
      },
      null,
      2
    )
  );

  if (lastError) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
