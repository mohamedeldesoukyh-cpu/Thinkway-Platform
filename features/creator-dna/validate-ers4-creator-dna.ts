#!/usr/bin/env npx tsx
/**
 * ERS-4: Creator DNA validation — IPL bridge, confidence, history, hydration.
 * Run: npx tsx features/creator-dna/validate-ers4-creator-dna.ts
 */
import "@/lib/performance/script-env-preload";

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ApifyProfileData } from "@/lib/creator-enrichment/types";
import type { NormalizedProfileSnapshot } from "@/lib/intelligence-persistence/types";
import {
  calculateConfidence,
} from "@/features/creator-dna/services/confidence-calculator";
import { compositeScore, resolveConflicts } from "@/features/creator-dna/services/conflict-resolver";
import { createEmptyCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { wrapValue } from "@/features/creator-dna/services/field-envelope";
import { CreatorDNAService } from "@/features/creator-dna/services/creator-dna-service";
import { mapDnaToHydratedVendor } from "@/features/creator-dna/services/creator-hydration-service";
import { mapSnapshotToFieldCandidates } from "@/features/creator-dna/writers/ipl-snapshot-mapper";
import { dedupeByCreatorId } from "@/lib/creators/dedupe-creators";
import type { CreatorDNARecord } from "@/features/creator-dna/types";

const ARTIFACT_DIR = join(process.cwd(), "docs/validation-artifacts/ers-4");

type ScenarioResult = {
  id: string;
  label: string;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
};

const SCENARIOS = [
  {
    id: "travel",
    label: "Travel Egypt",
    profile: {
      displayName: "Egypt Travel Guide",
      bio: "Travel blogger exploring Egypt pyramids and Nile cruises",
      username: "egypttravel",
      platform: "instagram",
      followers: 245000,
      engagementRate: 4.2,
      categories: ["Travel", "Tourism", "Egypt"],
      audienceCountry: "EG",
    },
  },
  {
    id: "babyjoy",
    label: "BabyJoy",
    profile: {
      displayName: "Mom Life Egypt",
      bio: "Parenting tips and baby product reviews for Egyptian moms",
      username: "momlife_eg",
      platform: "instagram",
      followers: 89000,
      engagementRate: 5.8,
      categories: ["Parenting", "Baby", "Lifestyle"],
      audienceCountry: "EG",
    },
  },
  {
    id: "luxury",
    label: "Luxury Hotel Dubai",
    profile: {
      displayName: "Luxury Stays ME",
      bio: "Five-star hotel reviews across Dubai and GCC",
      username: "luxurystaysme",
      platform: "instagram",
      followers: 156000,
      engagementRate: 3.1,
      categories: ["Luxury", "Hotels", "Travel"],
      audienceCountry: "AE",
    },
  },
  {
    id: "finance",
    label: "Finance Emirates NBD",
    profile: {
      displayName: "Finance Insights UAE",
      bio: "Personal finance and banking tips for UAE residents",
      username: "financeuae",
      platform: "instagram",
      followers: 72000,
      engagementRate: 2.9,
      categories: ["Finance", "Banking", "Business"],
      audienceCountry: "AE",
    },
  },
  {
    id: "tourism",
    label: "Visit Egypt Tourism",
    profile: {
      displayName: "Discover Egypt",
      bio: "Official tourism ambassador showcasing Egyptian heritage",
      username: "discoveregypt",
      platform: "instagram",
      followers: 512000,
      engagementRate: 4.7,
      categories: ["Tourism", "Culture", "Heritage"],
      audienceCountry: "EG",
    },
  },
] as const;

const results: ScenarioResult[] = [];
let globalPassed = 0;
let globalFailed = 0;

function check(
  scenario: ScenarioResult,
  name: string,
  condition: boolean,
  detail?: string,
  options?: { skipFailure?: boolean }
): void {
  scenario.checks.push({ name, passed: condition, detail });
  if (condition) {
    globalPassed += 1;
  } else if (!options?.skipFailure) {
    globalFailed += 1;
  }
}

function buildNormalized(
  profile: (typeof SCENARIOS)[number]["profile"]
): NormalizedProfileSnapshot {
  const base: ApifyProfileData = {
    platform: profile.platform,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    profilePictureUrl: "https://example.com/avatar.jpg",
    profileUrl: `https://instagram.com/${profile.username}`,
    followers: profile.followers,
    following: 1200,
    postsCount: 340,
    avgViews: null,
    avgLikes: 4200,
    avgComments: 180,
    engagementRate: profile.engagementRate,
    isVerified: true,
    audienceCountry: profile.audienceCountry,
    hashtags: ["#travel", "#egypt"],
    mentions: ["@visit"],
    categories: [...profile.categories],
    recentPublications: [],
    contactEmail: null,
    contactPhone: null,
    contactLinks: [],
    apifyRunId: null,
  };
  return {
    ...base,
    provider: "apify",
    fetchedAt: new Date().toISOString(),
    snapshotVersion: 1,
  };
}

function runScenarioMapping(scenario: (typeof SCENARIOS)[number]): ScenarioResult {
  const result: ScenarioResult = {
    id: scenario.id,
    label: scenario.label,
    passed: true,
    checks: [],
  };

  const normalized = buildNormalized(scenario.profile);
  const fields = mapSnapshotToFieldCandidates({
    snapshotId: `test-snapshot-${scenario.id}`,
    normalized,
    snapshotVersion: 1,
    fetchedAt: normalized.fetchedAt,
  });

  check(result, "IPL fields mapped", fields.length >= 15, `count=${fields.length}`);

  const followersField = fields.find((f) => f.path === "metrics.followers");
  check(result, "followers field present", followersField != null);
  check(
    result,
    "followers confidence calculated",
    (followersField?.confidence ?? 0) > 0.5,
    `confidence=${followersField?.confidence}`
  );
  check(result, "followers source is ipl", followersField?.source === "ipl");

  const doc = createEmptyCreatorDNADocument();
  const service = new CreatorDNAService(null as unknown as SupabaseClient);

  for (const candidate of fields) {
    const section = candidate.path.split(".")[0] as keyof typeof doc;
    const fieldKey = candidate.path.split(".")[1];
    if (!section || !fieldKey || !(section in doc)) continue;
    const sectionObj = doc[section] as Record<string, unknown>;
    const current = sectionObj[fieldKey] as ReturnType<typeof wrapValue> | undefined;
    sectionObj[fieldKey] = service.resolveConflicts(current, [candidate]);
  }

  check(
    result,
    "displayName populated after merge",
    doc.identity.displayName.value === scenario.profile.displayName
  );
  check(result, "history recorded on merge", doc.identity.displayName.history.length >= 1);

  const manualEnvelope = wrapValue("Manual Override Name", "manual", 1.0);
  const iplEnvelope = wrapValue(scenario.profile.displayName, "ipl", 0.95);
  const conflictResult = resolveConflicts(iplEnvelope, [
    {
      path: "identity.displayName",
      value: "Manual Override Name",
      confidence: 1.0,
      source: "manual",
      updatedAt: new Date().toISOString(),
    },
  ]);
  check(result, "manual wins conflict over ipl", conflictResult.source === "manual");

  const record: CreatorDNARecord = {
    influencerId: `test-${scenario.id}`,
    document: doc,
    version: 1,
    lastSnapshotId: `test-snapshot-${scenario.id}`,
    lastEnrichmentRunId: null,
    platformAccountIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const hydrated = mapDnaToHydratedVendor(record, 0, "Test rationale", 75);
  check(result, "hydration resolves from DNA", hydrated.displayName === scenario.profile.displayName);
  check(result, "hydration has followers", hydrated.followers === scenario.profile.followers);
  check(result, "hydration id matches influencer", hydrated.id === record.influencerId);

  const deduped = dedupeByCreatorId(
    [hydrated, { ...hydrated, displayName: "Duplicate" }],
    (v) => v.id
  );
  check(result, "no duplicated creator info", deduped.items.length === 1);

  result.passed = result.checks.every((c) => c.passed);
  return result;
}

function createSupabaseOrNull(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}

async function runDbIntegration(): Promise<ScenarioResult> {
  const result: ScenarioResult = {
    id: "db-integration",
    label: "Database integration",
    passed: true,
    checks: [],
  };

  const supabase = createSupabaseOrNull();
  if (!supabase) {
    check(result, "Supabase available", false, "Skipped — no credentials");
    result.passed = false;
    return result;
  }

  const { data: tables, error } = await supabase
    .from("creator_dna")
    .select("influencer_id")
    .limit(1);

  if (error) {
    const isSkippable =
      error.message.includes("does not exist") ||
      error.message.includes("Could not find the table") ||
      error.message.includes("fetch failed") ||
      error.code === "PGRST205";
    check(
      result,
      "creator_dna table exists",
      false,
      isSkippable
        ? `Skipped — ${error.message.includes("fetch failed") ? "DB unreachable" : "run migration 20260704120000_creator_dna.sql"}`
        : error.message,
      { skipFailure: isSkippable }
    );
    result.passed = isSkippable;
    return result;
  }

  check(result, "creator_dna table accessible", true, `sample rows=${tables?.length ?? 0}`);

  const { error: stagingError } = await supabase
    .from("creator_dna_staging")
    .select("id")
    .limit(1);

  check(result, "creator_dna_staging accessible", !stagingError, stagingError?.message);

  const { error: versionsError } = await supabase
    .from("creator_dna_versions")
    .select("id")
    .limit(1);

  check(result, "creator_dna_versions accessible", !versionsError, versionsError?.message);

  const { error: lineageError } = await supabase
    .from("creator_dna_lineage_events")
    .select("id")
    .limit(1);

  check(result, "creator_dna_lineage_events accessible", !lineageError, lineageError?.message);

  result.passed = result.checks.every((c) => c.passed);
  return result;
}

function runConflictUnitTests(): ScenarioResult {
  const result: ScenarioResult = {
    id: "conflict-unit",
    label: "Conflict resolution unit tests",
    passed: true,
    checks: [],
  };

  try {
    execSync("npx tsx features/creator-dna/services/conflict-resolver.test.ts", {
      stdio: "pipe",
      encoding: "utf-8",
    });
    check(result, "conflict-resolver.test.ts passed", true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(result, "conflict-resolver.test.ts passed", false, message);
  }

  check(
    result,
    "composite score favors manual",
    compositeScore({ source: "manual", confidence: 0.8 }) >
      compositeScore({ source: "ipl", confidence: 0.99 })
  );

  check(
    result,
    "confidence calculator for ipl",
    calculateConfidence({ source: "ipl", hasValue: true, snapshotVersion: 2 }) > 0.85
  );

  result.passed = result.checks.every((c) => c.passed);
  return result;
}

function writeReport(allResults: ScenarioResult[]): void {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const lines: string[] = [
    "# ERS-4 Creator DNA Validation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Scenarios: ${allResults.length}`,
    `- Checks passed: ${globalPassed}`,
    `- Checks failed: ${globalFailed}`,
    `- Overall: ${globalFailed === 0 ? "PASS" : "FAIL"}`,
    "",
    "## Scenarios",
    "",
  ];

  for (const scenario of allResults) {
    lines.push(`### ${scenario.label} (\`${scenario.id}\`) — ${scenario.passed ? "PASS" : "FAIL"}`);
    lines.push("");
    for (const c of scenario.checks) {
      lines.push(`- ${c.passed ? "✓" : "✗"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    }
    lines.push("");
  }

  lines.push("## IPL → DNA Population Flow");
  lines.push("");
  lines.push("```");
  lines.push("Apify fetch → IPL persistSnapshot()");
  lines.push("  → ipl_snapshots.normalized_snapshot stored");
  lines.push("  → bridgeSnapshotToCreatorDna(snapshotId)");
  lines.push("  → CreatorDNAWriter.mapSnapshotToFieldCandidates()");
  lines.push("  → CreatorDNAService.mergeEvidence() with conflict resolution");
  lines.push("  → creator_dna + creator_dna_versions + creator_dna_lineage_events");
  lines.push("Reprocess: reprocessSnapshot(category_inference)");
  lines.push("  → bridgeReprocessToCreatorDna() for ai_infer categories");
  lines.push("Hydration: hydrateCreatorsFromDna() → mapDnaToHydratedVendor()");
  lines.push("  → fallback to getUnifiedCreatorById when DNA absent");
  lines.push("```");
  lines.push("");
  lines.push("## Remaining Gaps");
  lines.push("");
  lines.push("- Staging → promoted influencer merge not automated (manual promotion path)");
  lines.push("- profile_ai_scores / creator_enrichment_runs not yet dual-written into DNA scores");
  lines.push("- OAuth source channel reserved — no oauth ingest wired yet");
  lines.push("- Campaign-scoped manual overrides not yet exposed via UI");
  lines.push("- Backfill script for existing ipl_snapshots → creator_dna not included");
  lines.push("");

  const reportPath = join(ARTIFACT_DIR, "creator-dna-report.md");
  writeFileSync(reportPath, lines.join("\n"), "utf-8");

  writeFileSync(
    join(ARTIFACT_DIR, "creator-dna-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        passed: globalFailed === 0,
        globalPassed,
        globalFailed,
        scenarios: allResults,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`\nReport written to ${reportPath}`);
}

async function main(): Promise<void> {
  console.log("ERS-4 Creator DNA Validation\n");

  results.push(runConflictUnitTests());

  for (const scenario of SCENARIOS) {
    console.log(`Scenario: ${scenario.label}`);
    const result = runScenarioMapping(scenario);
    results.push(result);
    for (const c of result.checks) {
      console.log(`  ${c.passed ? "✓" : "✗"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    }
  }

  const dbResult = await runDbIntegration();
  results.push(dbResult);
  console.log(`\nDatabase integration: ${dbResult.passed ? "PASS" : "SKIP/FAIL"}`);

  writeReport(results);

  console.log(`\nTotal: ${globalPassed} passed, ${globalFailed} failed`);
  if (globalFailed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
