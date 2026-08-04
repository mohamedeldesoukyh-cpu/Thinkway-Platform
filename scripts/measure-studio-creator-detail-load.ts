/**
 * Server-side timing soak for Studio hydration + Creator Detail progressive load.
 *
 * Target: Development Supabase only (hsxrewjcbvmbkqdlzjhs).
 *
 * Usage:
 *   npx tsx scripts/measure-studio-creator-detail-load.ts
 *   npx tsx scripts/measure-studio-creator-detail-load.ts --influencer=<uuid>
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { hydrateCreatorsFromDna } from "../features/creator-dna/services/creator-hydration-service";
import { enrichCreatorsWithEciInvestment } from "../features/discovery/services/eci/enrich-creators-with-eci";
import { getUnifiedCreatorById } from "../lib/creators/unified-browse";
import { loadCreatorHistoricalMetrics } from "../lib/creators/historical-metrics";
import { loadStudioEciPlanningSignals } from "../features/campaign-studio/services/eci/load-studio-eci-signals";
import { tryCreateServiceRoleClient } from "../lib/supabase/service-role-client";

type Mark = { name: string; ms: number; meta?: Record<string, unknown> };

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

async function time<T>(
  name: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<{ result: T; mark: Mark }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, mark: { name, ms: Date.now() - t0, meta } };
}

function printWaterfall(title: string, marks: Mark[]) {
  console.log(`\n=== ${title} ===`);
  const max = Math.max(...marks.map((m) => m.ms), 1);
  for (const m of marks) {
    const bar = "█".repeat(Math.max(1, Math.round((m.ms / max) * 24)));
    console.log(`${m.ms.toString().padStart(5)}ms  ${bar}  ${m.name}`);
    if (m.meta) console.log(`         ${JSON.stringify(m.meta)}`);
  }
  const total = marks.reduce((s, m) => s + m.ms, 0);
  console.log(`sum(serial-equivalent)=${total}ms  critical-path≈max parallel groups`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const projectRef = url.includes("hsxrewjcbvmbkqdlzjhs")
    ? "hsxrewjcbvmbkqdlzjhs"
    : new URL(url || "https://invalid.local").hostname.split(".")[0];
  if (projectRef !== "hsxrewjcbvmbkqdlzjhs") {
    throw new Error(
      `Refusing to run soak against non-Development project (${projectRef}). Expected hsxrewjcbvmbkqdlzjhs.`
    );
  }

  const resolved = tryCreateServiceRoleClient();
  if (!resolved.client) {
    // Fallback for older env naming
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      throw new Error(`No service role client: ${resolved.reason}`);
    }
  }
  const supabase =
    resolved.client ??
    createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const argInfluencer = process.argv
    .find((a) => a.startsWith("--influencer="))
    ?.slice("--influencer=".length);

  let influencerId = argInfluencer?.trim() || "";
  if (!influencerId) {
    const { data, error } = await supabase
      .from("influencers")
      .select("id")
      .eq("enrichment_status", "enriched")
      .order("last_enriched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.id) {
      const fallback = await supabase.from("influencers").select("id").limit(1).maybeSingle();
      if (fallback.error || !fallback.data?.id) {
        throw new Error(`No influencer seed: ${error?.message ?? fallback.error?.message ?? "empty"}`);
      }
      influencerId = fallback.data.id;
    } else {
      influencerId = data.id;
    }
  }

  const unifiedId = `inf:${influencerId}`;
  console.log(`Soak target influencer=${influencerId} project=${projectRef}`);

  // --- Creator Detail: BEFORE (monolithic) vs AFTER (phased) ---
  const beforeMarks: Mark[] = [];
  {
    const { result: creator, mark: m1 } = await time("BEFORE.detail.getUnifiedCreatorById", () =>
      getUnifiedCreatorById(supabase, unifiedId)
    );
    beforeMarks.push(m1);
    if (!creator) throw new Error("Creator not found");

    const { mark: m2 } = await time("BEFORE.detail.eciEnrich", () =>
      enrichCreatorsWithEciInvestment(supabase, [creator], { concurrency: 1 })
    );
    beforeMarks.push(m2);

    const { mark: m3 } = await time("BEFORE.detail.historical", () =>
      loadCreatorHistoricalMetrics(supabase, unifiedId)
    );
    beforeMarks.push(m3);

    const beforeCritical = m1.ms + m2.ms + m3.ms;
    beforeMarks.push({
      name: "BEFORE.detail.criticalPath(serial_all)",
      ms: beforeCritical,
      meta: { note: "Old sheet awaited detail+ECI+history together" },
    });
  }

  const afterMarks: Mark[] = [];
  {
    const { result: creator, mark: m1 } = await time("AFTER.detail.phase1.core", () =>
      getUnifiedCreatorById(supabase, unifiedId)
    );
    afterMarks.push(m1);
    if (!creator) throw new Error("Creator not found");

    const eciP = time("AFTER.detail.phase2.eci", () =>
      enrichCreatorsWithEciInvestment(supabase, [creator], { concurrency: 1 })
    );
    const histP = time("AFTER.detail.phase3.historical", () =>
      loadCreatorHistoricalMetrics(supabase, unifiedId)
    );
    const [eciR, histR] = await Promise.all([eciP, histP]);
    afterMarks.push(eciR.mark, histR.mark);

    const perceivedPhase1 = m1.ms;
    const phase2Ready = m1.ms + eciR.mark.ms;
    const allReady = m1.ms + Math.max(eciR.mark.ms, histR.mark.ms);
    afterMarks.push(
      { name: "AFTER.detail.perceivedPhase1(core)", ms: perceivedPhase1 },
      { name: "AFTER.detail.phase2Ready(core+eci)", ms: phase2Ready },
      { name: "AFTER.detail.allPanelsReady", ms: allReady }
    );
  }

  // --- Studio hydration: BEFORE 25 full vs AFTER wave1/2/3 ---
  const { data: slateIds, error: slateErr } = await supabase
    .from("influencers")
    .select("id")
    .limit(25);
  if (slateErr || !slateIds?.length) {
    throw new Error(`Could not load slate sample: ${slateErr?.message ?? "empty"}`);
  }
  const creatorIds = slateIds.map((r) => `inf:${r.id}`);

  const studioBefore: Mark[] = [];
  {
    const { mark } = await time("BEFORE.studio.hydrate25.fullEci", () =>
      hydrateCreatorsFromDna(supabase, creatorIds, {
        includeEci: true,
        includeQuotationPrices: true,
      })
    );
    studioBefore.push(mark);
  }

  const studioAfter: Mark[] = [];
  {
    // Headless proxy for a typical above-the-fold slate (client uses viewport height).
    const seedCount = Math.min(creatorIds.length, 8);
    const phase1Ids = creatorIds.slice(0, seedCount);
    const phase3Ids = creatorIds.slice(seedCount);

    const { mark: w1 } = await time(`AFTER.studio.phase1.dnaOnly.viewportSeed.n${seedCount}`, () =>
      hydrateCreatorsFromDna(supabase, phase1Ids, {
        includeEci: false,
        includeQuotationPrices: false,
      })
    );
    studioAfter.push(w1);

    const { mark: w2 } = await time(`AFTER.studio.phase2.eciOverlay.n${seedCount}`, () =>
      loadStudioEciPlanningSignals(supabase, phase1Ids)
    );
    studioAfter.push(w2);

    if (phase3Ids.length) {
      const { mark: w3 } = await time(`AFTER.studio.phase3.onScroll.n${phase3Ids.length}`, () =>
        hydrateCreatorsFromDna(supabase, phase3Ids, {
          includeEci: true,
          includeQuotationPrices: true,
        })
      );
      studioAfter.push(w3);
    }

    studioAfter.push({
      name: "AFTER.studio.perceivedPhase1",
      ms: w1.ms,
      meta: { targetMs: 500, seedCount, mode: "viewport-adaptive" },
    });
    studioAfter.push({
      name: "AFTER.studio.phase2Ready",
      ms: w1.ms + w2.ms,
      meta: {
        targetMs: 1000,
        note: "Visible DNA + ECI overlay; remainder hydrates on scroll",
      },
    });
    studioAfter.push({
      name: "AFTER.detail.firstMeaningfulPaint",
      ms: 0,
      meta: { note: "Creator Detail FMP = list-row shell (image/name/handle/followers/country/categories/badge)" },
    });
  }

  // Isolated ECI signal cost (diagnostic)
  const eciDiag: Mark[] = [];
  {
    const sample = creatorIds.slice(0, 6);
    const { mark } = await time("DIAG.eci.signals.n6", () =>
      loadStudioEciPlanningSignals(supabase, sample)
    );
    eciDiag.push(mark);
    const { mark: m25 } = await time("DIAG.eci.signals.n25", () =>
      loadStudioEciPlanningSignals(supabase, creatorIds)
    );
    eciDiag.push(m25);
  }

  printWaterfall("Creator Detail BEFORE", beforeMarks);
  printWaterfall("Creator Detail AFTER", afterMarks);
  printWaterfall("Studio hydration BEFORE", studioBefore);
  printWaterfall("Studio hydration AFTER", studioAfter);
  printWaterfall("ECI diagnostics", eciDiag);

  const summary = {
    environment: "Development",
    projectRef,
    influencerId,
    creatorDetail: {
      beforeCriticalSerialMs: beforeMarks.find((m) => m.name.includes("criticalPath"))?.ms,
      afterPhase1Ms: afterMarks.find((m) => m.name.includes("perceivedPhase1"))?.ms,
      afterPhase2Ms: afterMarks.find((m) => m.name.includes("phase2Ready"))?.ms,
      afterAllMs: afterMarks.find((m) => m.name.includes("allPanelsReady"))?.ms,
    },
    studio: {
      beforeFull25Ms: studioBefore[0]?.ms,
      afterPhase1Ms: studioAfter.find((m) => m.name === "AFTER.studio.perceivedPhase1")?.ms,
      afterPhase2Ms: studioAfter.find((m) => m.name === "AFTER.studio.phase2Ready")?.ms,
    },
  };
  console.log("\nJSON_SUMMARY\n" + JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
