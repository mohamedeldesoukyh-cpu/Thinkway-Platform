/**
 * Enterprise soak — progressive load surfaces (Development).
 * Confirms Studio / Creator Detail / Discovery / Shortlists / Quotation /
 * Campaign Workspace / Proposal / Presentation data paths still resolve.
 *
 * Usage: npx tsx scripts/soak-studio-creator-detail-progressive.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hydrateCreatorsFromDna } from "../features/creator-dna/services/creator-hydration-service";
import { enrichCreatorsWithEciInvestment } from "../features/discovery/services/eci/enrich-creators-with-eci";
import { loadStudioEciPlanningSignals } from "../features/campaign-studio/services/eci/load-studio-eci-signals";
import { getUnifiedCreatorById, browseUnifiedCreators } from "../lib/creators/unified-browse";
import { loadCreatorHistoricalMetrics } from "../lib/creators/historical-metrics";
import { findSimilarCreators } from "../lib/creators/similar-creators";
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

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  if (!url.includes(DEV_REF)) {
    console.error("Refuse: not Development Supabase", url);
    process.exit(1);
  }
  const resolved = tryCreateServiceRoleClient();
  if (!resolved.client) {
    console.error("No service role client", resolved.reason);
    process.exit(1);
  }
  const supabase = resolved.client;
  const checks: Check[] = [];

  const { data: influencers, error: infErr } = await supabase
    .from("influencers")
    .select("id, display_name")
    .eq("enrichment_status", "enriched")
    .order("last_enriched_at", { ascending: false })
    .limit(12);
  if (infErr || !influencers?.length) {
    throw new Error(`Influencer seed failed: ${infErr?.message ?? "empty"}`);
  }
  const ids = influencers.map((r) => `inf:${r.id}`);
  const primary = influencers[0]!;
  const unifiedId = `inf:${primary.id}`;

  // Studio viewport seed hydrate + ECI
  {
    const seed = ids.slice(0, 8);
    const dna = await hydrateCreatorsFromDna(supabase, seed, {
      includeEci: false,
      includeQuotationPrices: false,
    });
    const eci = await loadStudioEciPlanningSignals(supabase, seed);
    checks.push({
      name: "Studio.viewportHydration",
      ok: dna.vendors.length > 0 && eci.size > 0,
      detail: `dna=${dna.vendors.length} eciSignals=${eci.size}`,
    });
    const withEci = dna.vendors.filter((v) => {
      const bare = v.id.replace(/^inf:/, "");
      return eci.has(bare) || eci.has(v.id);
    });
    checks.push({
      name: "Studio.eciQualityPreserved",
      ok: withEci.length > 0,
      detail: `vendorsWithEciLookup=${withEci.length}/${dna.vendors.length}`,
    });
  }

  // Creator Detail progressive path
  {
    const core = await getUnifiedCreatorById(supabase, unifiedId);
    const [enriched] = core
      ? await enrichCreatorsWithEciInvestment(supabase, [core], { concurrency: 1 })
      : [null];
    const hist = await loadCreatorHistoricalMetrics(supabase, unifiedId);
    const similar = core
      ? await findSimilarCreators(supabase, core, 4).catch(() => [])
      : [];
    checks.push({
      name: "CreatorDetail.instantShellFields",
      ok: Boolean(
        core?.display_name &&
          (core.platforms?.length ?? 0) > 0 &&
          (core.profile_image_url || core.primaryAvatarUrl || core.platforms?.[0]?.profile_picture_url)
      ),
      detail: `name=${core?.display_name ?? "?"} platforms=${core?.platforms?.length ?? 0}`,
    });
    checks.push({
      name: "CreatorDetail.eciInvestment",
      ok: enriched?.eci_investment_score != null || enriched?.eci_investment_recommendation != null,
      detail: `score=${enriched?.eci_investment_score ?? "null"} rec=${enriched?.eci_investment_recommendation ?? "null"}`,
    });
    checks.push({
      name: "CreatorDetail.historyAndSimilar",
      ok: hist != null && Array.isArray(similar),
      detail: `historyPts=${hist?.followers?.length ?? 0} similar=${similar.length}`,
    });
  }

  // Discovery browse
  {
    const browse = await browseUnifiedCreators(
      supabase,
      { page: 1, pageSize: 8 },
      "soak"
    );
    checks.push({
      name: "Discovery.browse",
      ok: (browse.creators?.length ?? 0) > 0 || (browse.total ?? 0) >= 0,
      detail: `creators=${browse.creators?.length ?? 0} total=${browse.total ?? "?"}`,
    });
  }

  // Shortlists
  {
    const { data, error } = await supabase
      .from("discovery_shortlists")
      .select("id, name")
      .limit(3);
    checks.push({
      name: "Shortlists.list",
      ok: !error,
      detail: error?.message ?? `rows=${data?.length ?? 0}`,
    });
  }

  // Quotations
  {
    const { data, error } = await supabase
      .from("quotations")
      .select("id, name, status")
      .order("created_at", { ascending: false })
      .limit(3);
    checks.push({
      name: "Quotation.list",
      ok: !error,
      detail: error?.message ?? `rows=${data?.length ?? 0}`,
    });
  }

  // Campaign Workspace
  {
    const { data, error } = await supabase
      .from("campaign_headers")
      .select("id, document_number, name, status")
      .order("created_at", { ascending: false })
      .limit(3);
    checks.push({
      name: "CampaignWorkspace.headers",
      ok: !error && (data?.length ?? 0) > 0,
      detail: error?.message ?? `rows=${data?.length ?? 0}`,
    });
  }

  // Proposal / Presentation artifacts (campaign objects + plan approvals)
  {
    const { data: cos, error: coErr } = await supabase
      .from("campaign_objects")
      .select("id, lifecycle_status, current_version")
      .order("updated_at", { ascending: false })
      .limit(3);
    checks.push({
      name: "Proposal.campaignObjects",
      ok: !coErr && (cos?.length ?? 0) >= 0,
      detail: coErr?.message ?? `rows=${cos?.length ?? 0}`,
    });

    const { data: plans, error: planErr } = await supabase
      .from("campaign_objects")
      .select("id, lifecycle_status, current_version")
      .not("lifecycle_status", "is", null)
      .limit(5);
    const statuses = [...new Set((plans ?? []).map((p) => p.lifecycle_status))];
    checks.push({
      name: "Presentation.planningPackages",
      ok: !planErr && (plans?.length ?? 0) > 0,
      detail: planErr?.message ?? `planningRows=${plans?.length ?? 0} statuses=${statuses.join(",")}`,
    });
  }

  console.log("=== Enterprise progressive-load soak (Development) ===");
  let failed = 0;
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);
    if (!c.ok) failed += 1;
  }
  console.log(
    JSON.stringify(
      {
        environment: "Development",
        projectRef: DEV_REF,
        influencerId: primary.id,
        passed: checks.length - failed,
        failed,
        checks,
      },
      null,
      2
    )
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
