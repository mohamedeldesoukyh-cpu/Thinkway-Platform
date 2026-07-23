/**
 * Live browse payload inspection for country-flag regression triage.
 * Run: npx tsx scripts/inspect-discovery-browse-country-flags.ts
 *
 * Classifies whether missing flags are hydration / ViewModel / CSS
 * (CountryFlagsStack is not modified until this reports hydration gaps).
 */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";

function loadEnv(path: string) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env — cannot inspect live browse payload");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const started = performance.now();
  const result = await browseUnifiedCreators(
    supabase,
    { page: 1, pageSize: 50 },
    "flag-inspect"
  );
  const hydrationMs = Math.round(performance.now() - started);
  const payloadBytes = Buffer.byteLength(JSON.stringify(result.creators), "utf8");

  const samples = result.creators.slice(0, 12).map((creator) => {
    const vm = buildDiscoveryCreatorViewModel(creator);
    const hydrationHasCountry = Boolean(
      creator.country_code ||
        (creator.country_codes && creator.country_codes.length > 0) ||
        creator.estimated_country ||
        creator.platforms.some((p) => p.audience_country)
    );
    const viewModelHasFlag = vm.countryFlagCodes.length > 0;
    let layer: "ok" | "hydration" | "view_model" | "css_or_render" = "ok";
    if (!hydrationHasCountry && !viewModelHasFlag) layer = "hydration";
    else if (hydrationHasCountry && !viewModelHasFlag) layer = "view_model";
    else if (viewModelHasFlag) layer = "css_or_render";

    return {
      display_name: creator.display_name,
      country_code: creator.country_code,
      country_codes: creator.country_codes ?? null,
      estimated_country: creator.estimated_country,
      audience_countries: creator.platforms.map((p) => p.audience_country),
      feed_pubs: creator.recent_publications?.length ?? 0,
      feed_sample: (creator.recent_publications ?? []).slice(0, 1).map((p) => ({
        url: p.url,
        thumbnail: p.thumbnail,
        caption: p.caption,
        likes: p.likes,
      })),
      vm_countryFlagCodes: vm.countryFlagCodes,
      vm_countryLabel: vm.countryLabel,
      vm_feedPublications: vm.feedPublications.length,
      layer,
    };
  });

  const withFlags = samples.filter((s) => s.vm_countryFlagCodes.length > 0).length;
  const feedSlots = result.creators.reduce(
    (n, c) => n + (c.recent_publications?.length ?? 0),
    0
  );
  const creatorsWithFeed = result.creators.filter(
    (c) => (c.recent_publications?.length ?? 0) > 0
  ).length;

  const layerCounts = samples.reduce(
    (acc, s) => {
      acc[s.layer] = (acc[s.layer] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const report = {
    measuredAt: new Date().toISOString(),
    hydrationMs,
    creatorCount: result.creators.length,
    total: result.total,
    payloadBytes,
    payloadKb: Math.round((payloadBytes / 1024) * 10) / 10,
    feedPublicationSlots: feedSlots,
    creatorsWithFeed,
    feedRenderSuccessRateSample:
      result.creators.length > 0
        ? Math.round((creatorsWithFeed / result.creators.length) * 1000) / 10
        : 0,
    flagSample: {
      inspected: samples.length,
      withVmFlags: withFlags,
      layerCounts,
      rootCauseHint:
        layerCounts.hydration && !layerCounts.css_or_render
          ? "hydration — country fields missing on browse DTO"
          : layerCounts.view_model
            ? "view_model — DTO has country signals but countryFlagCodes empty"
            : layerCounts.css_or_render
              ? "css_or_render — ViewModel has countryFlagCodes; if UI shows none, inspect CSS/CountryFlagsStack (do not change until confirmed)"
              : "inconclusive",
    },
    samples,
  };

  const outDir = "docs/validation-artifacts/discovery-release-readiness";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = `${outDir}/browse-country-flag-inspect.json`;
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
