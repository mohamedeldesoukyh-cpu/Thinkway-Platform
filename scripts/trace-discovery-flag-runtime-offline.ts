/**
 * Offline preflight: browse payload → expected CountryFlagsStack props / DOM.
 * Does not touch React virtualization. Pair with browser tracer for divergence.
 *
 *   npx tsx scripts/trace-discovery-flag-runtime-offline.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(".env.local");
loadEnv(".env");

const PROBE = {
  source: "flag-render-probe-full-chain",
  countryFlagCodes: ["EG"],
  expectsFlagDom: true,
  componentTree: [
    "discovery-search-exact-row",
    "discovery-search-exact-photo-wrap",
    "discovery-search-exact-flag",
    "CountryFlagsStack/CountryFlagBadge",
    "img[flagcdn]",
  ],
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await browseUnifiedCreators(
    supabase,
    { page: 1, pageSize: 50 },
    "flag-runtime-trace"
  );

  const rows = result.creators.map((creator, index) => {
    const vm = buildDiscoveryCreatorViewModel(creator);
    const countryFlagCodes = vm.countryFlagCodes;
    return {
      virtualRowIndex: index,
      virtualItemKey: creator.unified_id,
      reactKey: creator.unified_id,
      creatorId: creator.influencer_id,
      creatorUnifiedId: creator.unified_id,
      displayName: creator.display_name,
      countryFlagCodes,
      country_codes: creator.country_codes ?? null,
      country_code: creator.country_code ?? null,
      audience_country: creator.platforms.map((p) => p.audience_country),
      countryFlagsStackProps: {
        countryCodes: countryFlagCodes,
        size: "md" as const,
        overlay: true,
        className: "size-full",
      },
      expectedRenderedDom: countryFlagCodes.length
        ? {
            hasFlagSlot: true,
            flagAriaLabel: countryFlagCodes[0],
            tree: PROBE.componentTree,
          }
        : { hasFlagSlot: false, tree: ["discovery-search-exact-row", "NO_FLAG"] },
      classification:
        countryFlagCodes.length === 0 ? "empty_props" : "expect_flag_dom",
      vsProbe:
        countryFlagCodes[0] === "EG"
          ? "matches_probe_codes"
          : countryFlagCodes.length > 0
            ? "has_codes_not_eg"
            : "diverges_at_countryFlagCodes_empty",
    };
  });

  const empty = rows.filter((r) => r.classification === "empty_props");
  const withCodes = rows.filter((r) => r.classification === "expect_flag_dom");

  // First divergence vs successful Puppeteer probe (which had countryFlagCodes=["EG"] + DOM flag)
  const firstEmpty = empty[0] ?? null;
  const firstDivergence = firstEmpty
    ? {
        point: "3.countryFlagCodes_non_empty",
        live: {
          creatorId: firstEmpty.creatorId,
          displayName: firstEmpty.displayName,
          countryFlagCodes: firstEmpty.countryFlagCodes,
          country_codes: firstEmpty.country_codes,
          country_code: firstEmpty.country_code,
          audience_country: firstEmpty.audience_country,
        },
        probe: { countryFlagCodes: PROBE.countryFlagCodes },
        category: "empty_props",
        note:
          "Offline: this row never reaches CountryFlagsStack/DOM flag. Live browser must confirm whether user-reported missing-flag rows are this class or expect_flag_dom with missing DOM.",
      }
    : {
        point: null,
        category: "no_empty_props_in_page",
        note:
          "All page-1 creators have countryFlagCodes. If user still sees missing flags, divergence is at live DOM/virtualization — run browser tracer.",
      };

  const report = {
    mode: "offline_payload_preflight",
    measuredAt: new Date().toISOString(),
    probeBaseline: PROBE,
    summary: {
      creators: rows.length,
      empty_props: empty.length,
      expect_flag_dom: withCodes.length,
    },
    firstDivergenceVsPuppeteerProbe: firstDivergence,
    sampleExpectFlag: withCodes[0] ?? null,
    sampleEmptyProps: firstEmpty,
    rows,
  };

  const outDir = path.join(
    process.cwd(),
    "docs/validation-artifacts/discovery-release-readiness"
  );
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "flag-runtime-trace-offline.json");
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
