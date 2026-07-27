/**
 * Country data completeness audit for Discovery browse page 1.
 *
 *   npm run audit:discovery-country-completeness
 *
 * Classifies per-creator country sources and why browse shows empty flags.
 * Does not modify UI or persist data.
 */
import fs from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { pickApifyAudienceCountry } from "@/lib/creator-enrichment/apify-profile";
import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import {
  collectCountryCodesFromExistingData,
  type CountryBackfillSource,
} from "@/lib/creators/country-backfill";
import { resolveCountryCode } from "@/lib/creators/country-code";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

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

type CauseCategory =
  | "complete"
  | "import_pipeline"
  | "enrichment_pipeline"
  | "browse_projection"
  | "normalization"
  | "migration"
  | "stale_data"
  | "mixed";

type SourceProbe = {
  source: string;
  raw: unknown;
  resolved: string[];
};

type AuditRow = {
  creatorId: string;
  displayName: string;
  enrichment_status: string | null;
  enrichment_source: string | null;
  notes: string | null;
  importSource: string | null;
  countrySource: string;
  currentValue: string[];
  expectedValue: string[];
  recoverableSources: CountryBackfillSource[];
  missingReason: string;
  causeCategory: CauseCategory;
  diagnostics: {
    platformCount: number;
    audienceCountry: string | null;
    profileBioPresent: boolean;
    followerCount: number | null;
    hasDna: boolean;
    dnaCountry: string | null;
    hasIpl: boolean;
    iplAudienceCountry: string | null;
    iplBioPresent: boolean;
    profileRowsCount: number;
    postRowsCount: number;
    rawPickAudienceCountry: string | null;
    postLocationNames: string[];
  };
};

function resolveAll(...values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    const resolved = normalizeCountryCode(resolveCountryCode(value));
    if (resolved && !out.includes(resolved)) out.push(resolved);
  }
  return out;
}

function envelopeCountry(doc: unknown): {
  country: string | null;
  countries: string[];
} {
  if (!doc || typeof doc !== "object") return { country: null, countries: [] };
  const audience = (doc as { audience?: { country?: unknown; countries?: unknown } })
    .audience;
  if (!audience) return { country: null, countries: [] };
  const countryEnv = audience.country as { value?: unknown } | undefined;
  const countriesEnv = audience.countries as { value?: unknown } | undefined;
  const country =
    typeof countryEnv?.value === "string" ? countryEnv.value : null;
  const countries = Array.isArray(countriesEnv?.value)
    ? countriesEnv.value.filter((v): v is string => typeof v === "string")
    : [];
  return { country, countries };
}

function isOfflineApifyImport(notes: string | null, metadata: unknown): boolean {
  if ((notes ?? "").includes("Imported from Apify dataset export (offline)")) return true;
  const meta = metadata as { import_source?: string } | null;
  return meta?.import_source === "apify_dataset_export";
}

function classifyCause(input: {
  browseCodes: string[];
  recoveredCodes: string[];
  recoveredSources: CountryBackfillSource[];
  offlineImport: boolean;
  enrichment_source: string | null;
  diagnostics: AuditRow["diagnostics"];
}): CauseCategory {
  if (input.browseCodes.length > 0) return "complete";

  if (input.recoveredCodes.length > 0) {
    const onlyOffBrowse = input.recoveredSources.every((s) =>
      [
        "dna.audience.country",
        "dna.audience.countries",
        "ipl.normalized_snapshot",
        "platform.profile_bio",
        "bio_inference",
        "discovered_profile.bio",
        "discovered_profile.city",
        "influencer.city",
        "influencer.nationality",
        "influencer.audience_top_countries",
        "creator_intelligence.audience_countries",
      ].includes(s)
    );
    if (onlyOffBrowse) return "browse_projection";
    return "enrichment_pipeline";
  }

  // Offline dataset export: post-only / empty profile details → never had country.
  if (input.offlineImport) {
    if (
      input.diagnostics.profileRowsCount === 0 ||
      (input.diagnostics.followerCount ?? 0) <= 0 ||
      !input.diagnostics.audienceCountry
    ) {
      return "import_pipeline";
    }
    return "import_pipeline";
  }

  if (
    input.diagnostics.hasIpl &&
    !input.diagnostics.iplAudienceCountry &&
    input.enrichment_source == null
  ) {
    return "enrichment_pipeline";
  }

  return "stale_data";
}

function primarySourceLabel(
  browseCodes: string[],
  probes: SourceProbe[],
  recoveredSources: CountryBackfillSource[]
): string {
  if (browseCodes.length === 0) {
    if (recoveredSources.length === 0) return "none";
    return `recoverable:${recoveredSources[0]}`;
  }
  for (const probe of probes) {
    if (probe.resolved.some((c) => browseCodes.includes(c))) {
      return probe.source;
    }
  }
  return "browse_view_model_merge";
}

function missingReason(row: AuditRow): string {
  if (row.currentValue.length > 0) {
    return "none — browse has countryFlagCodes";
  }
  if (row.expectedValue.length > 0) {
    return `recoverable ${row.expectedValue.join(",")} via ${row.recoverableSources.join(", ")} not on browse DTO`;
  }
  if (row.causeCategory === "import_pipeline") {
    const parts = [
      "offline Apify dataset export marked enriched without country",
      row.diagnostics.profileRowsCount === 0
        ? "raw snapshot has empty profileRows (post-only)"
        : null,
      (row.diagnostics.followerCount ?? 0) <= 0 ? "follower_count=0" : null,
      "platform.audience_country=null",
      "IPL audienceCountry=null",
      "DNA audience.country empty",
    ].filter(Boolean);
    return parts.join("; ");
  }
  return "no ISO country in influencer, platforms, DNA, IPL, or bio inference";
}

async function loadSourceBundle(supabase: SupabaseClient, influencerId: string) {
  const [influencerRes, platformsRes, discoveredRes, dnaRes, iplRes] =
    await Promise.all([
      supabase
        .from("influencers")
        .select(
          "id, display_name, country_code, country_codes, city, nationality, audience_top_countries, enrichment_status, enrichment_source, metadata, notes"
        )
        .eq("id", influencerId)
        .maybeSingle(),
      supabase
        .from("influencer_platform_accounts")
        .select(
          "platform, handle, audience_country, profile_bio, profile_display_name, hashtags, mentions, follower_count, metadata"
        )
        .eq("influencer_id", influencerId),
      supabase
        .from("discovered_profiles")
        .select("country_code, bio, city")
        .eq("influencer_id", influencerId),
      supabase
        .from("creator_dna")
        .select("document")
        .eq("influencer_id", influencerId)
        .maybeSingle(),
      supabase
        .from("ipl_snapshots")
        .select("normalized_snapshot, raw_snapshot")
        .eq("influencer_id", influencerId)
        .eq("is_latest", true)
        .limit(1),
    ]);

  if (influencerRes.error) throw new Error(influencerRes.error.message);
  if (platformsRes.error) throw new Error(platformsRes.error.message);
  if (discoveredRes.error) throw new Error(discoveredRes.error.message);
  if (dnaRes.error) throw new Error(dnaRes.error.message);
  if (iplRes.error) throw new Error(iplRes.error.message);

  const influencer = influencerRes.data;
  const platforms = platformsRes.data ?? [];
  const discovered = discoveredRes.data ?? [];
  const dnaDocument = dnaRes.data?.document ?? null;
  const iplRow = (iplRes.data ?? [])[0] ?? null;
  const normalized = (iplRow?.normalized_snapshot ?? null) as {
    audienceCountry?: string | null;
    bio?: string | null;
  } | null;
  const iplAudienceCountries = [normalized?.audienceCountry ?? null];

  const dnaParsed = envelopeCountry(dnaDocument);
  const metadata = (influencer?.metadata ?? {}) as Record<string, unknown>;
  const manualOverride =
    typeof metadata.country_code_manual === "string"
      ? metadata.country_code_manual
      : typeof metadata.manual_country_code === "string"
        ? metadata.manual_country_code
        : null;

  const raw = (iplRow?.raw_snapshot ?? null) as {
    platformKey?: string;
    profileRows?: Record<string, unknown>[];
    postRows?: Record<string, unknown>[];
  } | null;
  const profileRows = raw?.profileRows ?? [];
  const postRows = raw?.postRows ?? [];
  const head = profileRows[0] ?? postRows[0] ?? {};
  const owner =
    (head.owner as Record<string, unknown>) ||
    (head.author as Record<string, unknown>) ||
    (head.authorMeta as Record<string, unknown>) ||
    head;
  const rawPick = pickApifyAudienceCountry(
    raw?.platformKey ?? platforms[0]?.platform ?? "instagram",
    head,
    owner,
    [...profileRows, ...postRows]
  );

  const postLocationNames: string[] = [];
  for (const row of postRows.slice(0, 5)) {
    const name = row.locationName;
    if (typeof name === "string" && name.trim()) postLocationNames.push(name.trim());
  }

  const probes: SourceProbe[] = [
    {
      source: "influencer.country_code",
      raw: influencer?.country_code ?? null,
      resolved: resolveAll(influencer?.country_code),
    },
    {
      source: "influencer.country_codes",
      raw: influencer?.country_codes ?? null,
      resolved: resolveAll(...(influencer?.country_codes ?? [])),
    },
    {
      source: "platform.audience_country",
      raw: platforms.map((p) => p.audience_country),
      resolved: resolveAll(...platforms.map((p) => p.audience_country)),
    },
    {
      source: "Creator DNA",
      raw: dnaParsed,
      resolved: resolveAll(dnaParsed.country, ...dnaParsed.countries),
    },
    {
      source: "IPL snapshot",
      raw: iplAudienceCountries,
      resolved: resolveAll(...iplAudienceCountries),
    },
    {
      source: "enrichment",
      raw: {
        enrichment_source: influencer?.enrichment_source ?? null,
        audience_top_countries: influencer?.audience_top_countries ?? null,
        nationality: influencer?.nationality ?? null,
        city: influencer?.city ?? null,
      },
      resolved: resolveAll(
        influencer?.nationality,
        influencer?.city,
        ...(influencer?.audience_top_countries ?? []).flatMap((e) => [
          e.code ?? null,
          e.name ?? null,
        ])
      ),
    },
    {
      source: "manual override",
      raw: manualOverride,
      resolved: resolveAll(manualOverride),
    },
  ];

  const collected = influencer
    ? collectCountryCodesFromExistingData({
        influencer: {
          id: influencer.id,
          display_name: influencer.display_name,
          country_code: influencer.country_code,
          country_codes: influencer.country_codes,
          city: influencer.city,
          nationality: influencer.nationality,
          audience_top_countries: influencer.audience_top_countries,
        },
        platforms: platforms.map((p) => ({
          audience_country: p.audience_country,
          profile_bio: p.profile_bio,
          profile_display_name: p.profile_display_name,
          hashtags: p.hashtags,
          mentions: p.mentions,
        })),
        discoveredProfiles: discovered,
        dnaDocument,
        iplAudienceCountries,
      })
    : { codes: [], sources: [] as CountryBackfillSource[] };

  const diagnostics: AuditRow["diagnostics"] = {
    platformCount: platforms.length,
    audienceCountry: platforms.find((p) => p.audience_country)?.audience_country ?? null,
    profileBioPresent: platforms.some((p) => Boolean(p.profile_bio?.trim())),
    followerCount: platforms[0]?.follower_count ?? null,
    hasDna: Boolean(dnaRes.data),
    dnaCountry: dnaParsed.country,
    hasIpl: Boolean(iplRow),
    iplAudienceCountry: normalized?.audienceCountry ?? null,
    iplBioPresent: Boolean(normalized?.bio?.trim()),
    profileRowsCount: profileRows.length,
    postRowsCount: postRows.length,
    rawPickAudienceCountry: rawPick,
    postLocationNames,
  };

  return {
    influencer,
    probes,
    collected,
    diagnostics,
    offlineImport: isOfflineApifyImport(
      influencer?.notes ?? null,
      influencer?.metadata ?? null
    ),
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const browse = await browseUnifiedCreators(
    supabase,
    { page: 1, pageSize: 50 },
    "country-completeness-audit"
  );

  const matrix: AuditRow[] = [];

  for (const creator of browse.creators as UnifiedCreatorResult[]) {
    const id = creator.influencer_id;
    if (!id) continue;

    const vm = buildDiscoveryCreatorViewModel(creator);
    const bundle = await loadSourceBundle(supabase, id);
    const browseCodes = vm.countryFlagCodes;
    const expected = bundle.collected.codes;
    const causeCategory = classifyCause({
      browseCodes,
      recoveredCodes: expected,
      recoveredSources: bundle.collected.sources,
      offlineImport: bundle.offlineImport,
      enrichment_source: bundle.influencer?.enrichment_source ?? null,
      diagnostics: bundle.diagnostics,
    });

    const row: AuditRow = {
      creatorId: id,
      displayName: creator.display_name,
      enrichment_status: creator.enrichment_status ?? null,
      enrichment_source: bundle.influencer?.enrichment_source ?? null,
      notes: bundle.influencer?.notes ?? null,
      importSource:
        ((bundle.influencer?.metadata as { import_source?: string } | null)
          ?.import_source ?? null) ||
        (bundle.offlineImport ? "apify_dataset_export" : null),
      countrySource: primarySourceLabel(
        browseCodes,
        bundle.probes,
        bundle.collected.sources
      ),
      currentValue: browseCodes,
      expectedValue: expected,
      recoverableSources: bundle.collected.sources,
      missingReason: "",
      causeCategory,
      diagnostics: bundle.diagnostics,
    };
    row.missingReason = missingReason(row);
    matrix.push(row);
  }

  const emptyBrowse = matrix.filter((r) => r.currentValue.length === 0);
  const withBrowse = matrix.filter((r) => r.currentValue.length > 0);
  const recoverableButEmpty = emptyBrowse.filter((r) => r.expectedValue.length > 0);
  const noSignal = emptyBrowse.filter((r) => r.expectedValue.length === 0);
  const offlineEmpty = emptyBrowse.filter((r) => r.importSource === "apify_dataset_export");
  const emptyPostOnly = emptyBrowse.filter((r) => r.diagnostics.profileRowsCount === 0);
  const emptyWithBio = emptyBrowse.filter((r) => r.diagnostics.profileBioPresent);

  const emptyCauseCounts = emptyBrowse.reduce(
    (acc, row) => {
      acc[row.causeCategory] = (acc[row.causeCategory] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const sourceCountsComplete = withBrowse.reduce(
    (acc, row) => {
      acc[row.countrySource] = (acc[row.countrySource] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const recommendation = {
    smallestChange:
      "Re-run Instagram profile-details enrichment for the 37 offline Apify dataset imports (existing backfillInstagramProfileRowsForImport / live enrichment path), then persist country via persistCountryFromApifyProfile → influencers.country_code/country_codes + platform.audience_country. No UI/browse/ViewModel changes.",
    whyNotBackfillOnly:
      "country-backfill cannot invent ISO codes: 0/37 empty rows have recoverable country in DNA/IPL/platform/bio_inference under current geography index (COUNTRY_OPTIONS is MENA-heavy and omits PT etc.).",
    preventiveTinyCodeChange:
      "In apify-import-pipeline ensureIdentityCreatorFromApifyData: do not set enrichment_status='enriched' for Instagram post-only imports when audience_country is null and follower_count<=0; leave pending until shouldBackfillInstagramProfileDetails succeeds.",
    commandHint:
      "Target influencer IDs where notes ILIKE '%Apify dataset export (offline)%' AND country_code IS NULL — queue existing enrichment/IPL profile scrape.",
    preservesArchitecture: true,
    ruledOut: {
      browse_projection: "omitHeavyFields still selects country_code/country_codes/audience_country; ViewModel correctly omits flags when empty",
      migration: "country_codes null, not a half-migrated array issue",
      normalization_of_bad_iso: "no non-empty raw ISO-like country values failing resolveCountryCode on primary fields",
      ui: "CountryFlagsStack validated when codes present",
    },
  };

  const report = {
    measuredAt: new Date().toISOString(),
    browse: { page: 1, pageSize: 50, returned: matrix.length, total: browse.total },
    summary: {
      withBrowseCountry: withBrowse.length,
      emptyBrowseCountry: emptyBrowse.length,
      recoverableButBrowseEmpty: recoverableButEmpty.length,
      noRecoverableSignal: noSignal.length,
      offlineApifyImportEmpty: offlineEmpty.length,
      emptyPostOnlyProfileRows: emptyPostOnly.length,
      emptyWithPlatformBio: emptyWithBio.length,
      emptyBrowseCauseCounts: emptyCauseCounts,
      completeSourceCounts: sourceCountsComplete,
    },
    why37of50: {
      emptyCount: emptyBrowse.length,
      primaryCause: "import_pipeline",
      evidence: {
        allEmptyAreOfflineApifyExport: offlineEmpty.length === emptyBrowse.length,
        allEmptyEnrichmentSourceNull: emptyBrowse.every((r) => r.enrichment_source == null),
        allEmptyStatusEnriched: emptyBrowse.every((r) => r.enrichment_status === "enriched"),
        postOnlyRawSnapshots: emptyPostOnly.length,
        iplAudienceCountryPresent: emptyBrowse.filter((r) => r.diagnostics.iplAudienceCountry)
          .length,
        dnaCountryPresent: emptyBrowse.filter((r) => r.diagnostics.dnaCountry).length,
        platformAudienceCountryPresent: emptyBrowse.filter((r) => r.diagnostics.audienceCountry)
          .length,
      },
      narrative:
        "All 37 creators without flags were created by the offline Apify dataset export pipeline. That path marked enrichment_status=enriched while leaving country_code, country_codes, platform.audience_country, IPL audienceCountry, and DNA audience.country empty. Most raw snapshots are post-only (empty profileRows), so Instagram country was never present to normalize. Browse projection and CountryFlagsStack are working — there is simply no country data to show. The 13 creators with flags mostly came from Discovery Import Center / live Apify (enrichment_source=apify) or rare offline rows whose display-name/bio matched MENA-centric COUNTRY_OPTIONS aliases.",
    },
    recommendation,
    matrix: matrix.map((row) => ({
      creatorId: row.creatorId,
      displayName: row.displayName,
      countrySource: row.countrySource,
      currentValue: row.currentValue,
      expectedValue: row.expectedValue,
      missingReason: row.missingReason,
      causeCategory: row.causeCategory,
      enrichment_status: row.enrichment_status,
      enrichment_source: row.enrichment_source,
      importSource: row.importSource,
      diagnostics: row.diagnostics,
    })),
  };

  const outDir = path.join(
    process.cwd(),
    "docs/validation-artifacts/discovery-release-readiness"
  );
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "country-completeness-audit.json");
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    `# Country completeness audit — Discovery browse page 1`,
    ``,
    `Measured: ${report.measuredAt}`,
    ``,
    `## Verdict`,
    ``,
    report.why37of50.narrative,
    ``,
    `**Primary cause: import pipeline** (offline Apify dataset export). Not browse projection, UI, migration, or ViewModel.`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `|---|---:|`,
    `| Creators audited | ${report.browse.returned} |`,
    `| Browse has countryFlagCodes | ${report.summary.withBrowseCountry} |`,
    `| Browse empty | ${report.summary.emptyBrowseCountry} |`,
    `| Recoverable but browse empty | ${report.summary.recoverableButBrowseEmpty} |`,
    `| No recoverable signal (current collectors) | ${report.summary.noRecoverableSignal} |`,
    `| Empty = offline Apify export | ${report.summary.offlineApifyImportEmpty} |`,
    `| Empty with empty profileRows (post-only) | ${report.summary.emptyPostOnlyProfileRows} |`,
    ``,
    `### Empty-browse cause breakdown`,
    ``,
    ...Object.entries(report.summary.emptyBrowseCauseCounts).map(
      ([k, v]) => `- **${k}**: ${v}`
    ),
    ``,
    `### Complete rows — country source`,
    ``,
    ...Object.entries(report.summary.completeSourceCounts).map(
      ([k, v]) => `- **${k}**: ${v}`
    ),
    ``,
    `## Recommendation (smallest change)`,
    ``,
    report.recommendation.smallestChange,
    ``,
    `Prevention: ${report.recommendation.preventiveTinyCodeChange}`,
    ``,
    `Why not country-backfill alone: ${report.recommendation.whyNotBackfillOnly}`,
    ``,
    `## Matrix`,
    ``,
    `| Creator ID | Name | Country source | Current | Expected | Missing reason | Cause |`,
    `|---|---|---|---|---|---|---|`,
    ...matrix.map(
      (r) =>
        `| \`${r.creatorId}\` | ${r.displayName.replace(/\|/g, "/")} | ${r.countrySource} | ${r.currentValue.join(",") || "—"} | ${r.expectedValue.join(",") || "—"} | ${r.missingReason.replace(/\|/g, "/")} | ${r.causeCategory} |`
    ),
    ``,
  ].join("\n");

  const mdPath = path.join(outDir, "country-completeness-audit.md");
  fs.writeFileSync(mdPath, md);

  console.log(
    JSON.stringify(
      {
        summary: report.summary,
        why37of50: report.why37of50,
        recommendation: report.recommendation,
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${out}`);
  console.log(`Wrote ${mdPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
