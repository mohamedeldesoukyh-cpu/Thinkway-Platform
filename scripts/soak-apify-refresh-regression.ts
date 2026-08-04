/**
 * Post-refresh consumer regression — ECI load for Discovery / Studio / Compare surfaces.
 * Development Supabase only.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadCreatorIntelligenceBundle } from "../lib/enterprise-creator-intelligence";
import { tryCreateServiceRoleClient } from "../lib/supabase/service-role-client";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile(resolve(".env"));
loadEnvFile(resolve(".env.local"));

const DEV_REF = "hsxrewjcbvmbkqdlzjhs";
const ids = [
  "93e22da6-3419-493a-bb98-fe3e73457f8d", // IG soak
  "dfc3fe5b-d35a-43f6-9f29-6cd669b0fa8a", // both soak
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes(DEV_REF)) {
    console.error("Refuse: not Development");
    process.exit(1);
  }
  const { client, reason } = tryCreateServiceRoleClient();
  if (!client) {
    console.error(reason);
    process.exit(1);
  }

  const results = [];
  for (const influencerId of ids) {
    try {
      const bundle = await loadCreatorIntelligenceBundle(client, { influencerId });
      results.push({
        surface: "ECI_SSOT",
        consumers: ["Discovery", "Studio", "Shortlists", "Quotations", "Campaign", "Compare"],
        influencerId,
        ok: Boolean(bundle?.investment && bundle?.commercial),
        computedAt: bundle.computedAt,
        investmentScore: bundle.investment?.score ?? null,
        confidence: bundle.investment?.confidence ?? null,
      });
    } catch (error) {
      results.push({
        surface: "ECI_SSOT",
        influencerId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const { data: influencer } = await client
      .from("influencers")
      .select("enrichment_status, enrichment_source, metadata, last_enriched_at")
      .eq("id", influencerId)
      .maybeSingle();
    results.push({
      surface: "CreatorDetailFields",
      influencerId,
      ok:
        (influencer as { enrichment_status?: string } | null)?.enrichment_status ===
          "enriched" ||
        (influencer as { enrichment_status?: string } | null)?.enrichment_status ===
          "failed",
      enrichment_status: (influencer as { enrichment_status?: string } | null)
        ?.enrichment_status,
      enrichment_source: (influencer as { enrichment_source?: string } | null)
        ?.enrichment_source,
      last_manual_refresh: (influencer as { metadata?: { last_manual_refresh?: unknown } } | null)
        ?.metadata?.last_manual_refresh,
    });
  }

  const out = resolve("scripts/tmp-soak-apify-refresh-regression.json");
  writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
  console.log("wrote", out);
  if (results.some((r) => !r.ok)) process.exit(2);
  console.log("REGRESSION_PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
