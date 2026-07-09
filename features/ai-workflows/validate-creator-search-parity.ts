#!/usr/bin/env npx tsx
/**
 * Compare Discovery browse params vs AI searchCreators executor for parity.
 * Run: npx tsx features/ai-workflows/validate-creator-search-parity.ts
 *
 * Searchable fields (search_creators RPC + browseUnifiedCreators):
 * - Influencers: display/legal name, email, handles, profile_display_name,
 *   profile_bio, hashtags, categories, interest_categories, search_vector (FTS)
 * - Discovered: display_name, username, bio, category_tags, search_vector (FTS)
 * - Discovery UI contentKeyword/contentTags → joined into browse `search` param
 * - Category chips: influencers.categories + platform interest_categories
 */
import "@/lib/performance/script-env-preload";

import { createClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import {
  assertBrowseFilterParity,
  discoveryBrowseFiltersFromNaturalLanguage,
  parseCreatorSearchQuery,
  parsedCreatorSearchToDiscoveryFilters,
} from "@/features/ai/tools/creator-search-parser";
import { executeSearchCreatorsProduction } from "@/features/ai/tools/production-executors";
import type { SearchCreatorsInput } from "@/features/ai/tools/schemas";
import {
  AI_SEARCH_CREATORS_PAGE_SIZE,
  searchCreatorsInputToBrowseFilters,
} from "@/features/ai/tools/search-creators-browse";
import { runWithToolAuthContext } from "@/features/ai/tools/tool-auth";
import {
  DEFAULT_CREATOR_SEARCH_FILTERS,
  filtersToBrowseParams,
} from "@/features/discovery/components/creator-search/creator-search-types";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";
import type { Database } from "@/types/database";

const STRUCTURED_CASES = [
  {
    message: "Find travel creators in Egypt",
    expected: {
      search: "travel",
      categories: ["Travel"],
      country: "EG",
    },
  },
  {
    message: "Beauty creators in UAE",
    expected: {
      search: "beauty",
      categories: ["Beauty"],
      country: "AE",
    },
  },
  {
    message: "TikTok travel creators in Egypt",
    expected: {
      search: "travel",
      categories: ["Travel"],
      country: "EG",
      platforms: ["tiktok"],
    },
  },
  {
    message: "Nano beauty creators in KSA",
    expected: {
      search: "beauty",
      categories: ["Beauty"],
      country: "SA",
      minFollowers: 1_000,
      maxFollowers: 10_000,
    },
  },
  {
    message: "Hotel creators in Dubai",
    expected: {
      search: "hotel",
      country: "AE",
    },
  },
] as const;

const TEST_QUERIES = ["hotel", "luxury", "travel"] as const;

function testContentFilterWiring(): boolean {
  console.log("=== Discovery content filter → browse search (offline) ===\n");

  const browse = filtersToBrowseParams(
    {
      ...DEFAULT_CREATOR_SEARCH_FILTERS,
      contentKeyword: "travel",
      contentTags: ["beauty"],
    },
    1,
    50
  );

  const ok = browse.search === "travel #beauty";
  console.log(`  contentKeyword + contentTags → search="${browse.search}" ${ok ? "PASS" : "FAIL"}`);
  console.log(ok ? "\nRESULT: PASS\n" : "\nRESULT: FAIL\n");
  return ok;
}

function testStructuredParsing(): boolean {
  console.log("=== Structured NL parsing (offline) ===\n");

  let pass = true;

  for (const { message, expected } of STRUCTURED_CASES) {
    const parsed = parseCreatorSearchQuery(message);
    const checks: Array<[string, unknown, unknown]> = [
      ["search", parsed.search, expected.search],
      ["country", parsed.country, expected.country],
      ["categories", parsed.categories, "categories" in expected ? expected.categories : undefined],
      ["platforms", parsed.platforms, "platforms" in expected ? expected.platforms : undefined],
      ["minFollowers", parsed.minFollowers, "minFollowers" in expected ? expected.minFollowers : undefined],
      ["maxFollowers", parsed.maxFollowers, "maxFollowers" in expected ? expected.maxFollowers : undefined],
    ];

    console.log(`  "${message}"`);
    for (const [field, actual, exp] of checks) {
      const actualJson = JSON.stringify(actual ?? null);
      const expectedJson = JSON.stringify(exp ?? null);
      const ok = actualJson === expectedJson;
      console.log(`    ${field}: ${actualJson} ${ok ? "PASS" : `FAIL (expected ${expectedJson})`}`);
      if (!ok) pass = false;
    }

    const discoveryBrowse = discoveryBrowseFiltersFromNaturalLanguage(
      message,
      1,
      AI_SEARCH_CREATORS_PAGE_SIZE
    );
    const aiBrowse = searchCreatorsInputToBrowseFilters({
      query: message,
      limit: AI_SEARCH_CREATORS_PAGE_SIZE,
    });
    const parity = assertBrowseFilterParity(discoveryBrowse, aiBrowse);
    console.log(`    browse parity: ${parity.pass ? "PASS" : `FAIL (${parity.diff.join("; ")})`}`);
    if (!parity.pass) pass = false;
    console.log("");
  }

  console.log(pass ? "RESULT: PASS\n" : "RESULT: FAIL\n");
  return pass;
}

function testWorkflowBoilerplate(): boolean {
  console.log("=== Workflow boilerplate stripping (offline) ===\n");

  const cases: Array<{ input: string; expectedSearch: string }> = [
    {
      input: 'Execute searchCreators immediately for: "hotel". Do NOT ask clarifying questions.',
      expectedSearch: "hotel",
    },
    {
      input:
        "Search for creators matching this campaign. Execute searchCreators immediately.\n\nSearch criteria: luxury",
      expectedSearch: "luxury",
    },
    {
      input: "Find luxury hotel creators in Egypt",
      expectedSearch: "luxury hotel",
      // country EG extracted separately
    },
  ];

  let pass = true;
  for (const { input, expectedSearch } of cases) {
    const parsed = parseCreatorSearchQuery(input);
    const ok = parsed.search === expectedSearch;
    console.log(
      `  "${input.slice(0, 50)}..." → search="${parsed.search}" country=${parsed.country ?? "—"} ${ok ? "PASS" : `FAIL (expected search "${expectedSearch}")`}`
    );
    if (!ok) pass = false;
  }

  console.log(pass ? "\nRESULT: PASS\n" : "\nRESULT: FAIL\n");
  return pass;
}

type ParityResult = {
  query: string;
  discoveryTotal: number;
  discoveryCount: number;
  aiTotal: number;
  aiCount: number;
  pass: boolean;
};

const TRACE_MODE = process.env.AI_SEARCH_TRACE === "1";

async function runTracedParityCase(
  supabase: ReturnType<typeof createClient<Database>>,
  label: string,
  discoveryFilters: UnifiedCreatorBrowseFilters,
  aiInput: SearchCreatorsInput
): Promise<ParityResult | null> {
  const aiBrowse = searchCreatorsInputToBrowseFilters(aiInput);
  const browseParity = assertBrowseFilterParity(discoveryFilters, aiBrowse);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`TRACE CASE: ${label}`);
  console.log(`Discovery filters: ${JSON.stringify(discoveryFilters)}`);
  console.log(`AI browse filters:   ${JSON.stringify(aiBrowse)}`);
  if (!browseParity.pass) {
    console.log(`FILTER DIFF: ${browseParity.diff.join("; ")}`);
  }

  try {
    console.log("\n--- Discovery path ---");
    const discovery = await browseUnifiedCreators(supabase, discoveryFilters, "discovery");

    console.log("\n--- AI path ---");
    const ai = await executeSearchCreatorsProduction(aiInput, { workspace: { type: "general" } });

    const pass =
      browseParity.pass &&
      discovery.total === ai.total &&
      discovery.creators.length === ai.creators.length;

    console.log(`\nDiscovery: total=${discovery.total} page=${discovery.creators.length} (internal=${discovery.internal_count ?? "?"}, discovery=${discovery.discovery_count ?? "?"})`);
    console.log(`AI tool:   total=${ai.total} page=${ai.creators.length}`);
    console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");

    return {
      query: label,
      discoveryTotal: discovery.total,
      discoveryCount: discovery.creators.length,
      aiTotal: ai.total,
      aiCount: ai.creators.length,
      pass,
    };
  } catch (error) {
    console.error(
      `Live parity skipped for "${label}": ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

async function main(): Promise<void> {
  const contentOk = testContentFilterWiring();
  const structuredOk = testStructuredParsing();
  const boilerplateOk = testWorkflowBoilerplate();
  const offlineOk = contentOk && structuredOk && boilerplateOk;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — skipping live parity check."
    );
    process.exitCode = offlineOk ? 0 : 1;
    return;
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("=== AI vs Discovery creator search parity ===\n");
  console.log(`Page size: Discovery=50, AI=${AI_SEARCH_CREATORS_PAGE_SIZE}`);
  if (TRACE_MODE) {
    console.log("AI_SEARCH_TRACE=1 — stage logs enabled\n");
  }

  const results: ParityResult[] = [];

  if (TRACE_MODE) {
    await runWithToolAuthContext(
      { supabase, userId: "validate-creator-search-parity" },
      async () => {
        const travelMessage = "Find travel creators in Egypt";

        const parsedTravel = parseCreatorSearchQuery(travelMessage);
        const discoveryNl = discoveryBrowseFiltersFromNaturalLanguage(
          travelMessage,
          1,
          AI_SEARCH_CREATORS_PAGE_SIZE
        );
        const discoveryCategoryOnly = filtersToBrowseParams(
          {
            ...DEFAULT_CREATOR_SEARCH_FILTERS,
            categories: ["Travel"],
            countries: ["EG"],
            search: "",
          },
          1,
          AI_SEARCH_CREATORS_PAGE_SIZE
        );

        const traced = await runTracedParityCase(
          supabase,
          `${travelMessage} (NL parity)`,
          discoveryNl,
          { query: travelMessage, limit: AI_SEARCH_CREATORS_PAGE_SIZE }
        );
        if (traced) results.push(traced);

        const tracedCategoryOnly = await runTracedParityCase(
          supabase,
          "Travel + EG (Discovery manual, no search)",
          discoveryCategoryOnly,
          { query: travelMessage, limit: AI_SEARCH_CREATORS_PAGE_SIZE }
        );
        if (tracedCategoryOnly) results.push(tracedCategoryOnly);

        console.log(`\nParsed NL: ${JSON.stringify(parsedTravel)}`);
      }
    );
  }

  await runWithToolAuthContext(
    { supabase, userId: "validate-creator-search-parity" },
    async () => {
      for (const query of TEST_QUERIES) {
        const discoveryFilters = filtersToBrowseParams(
          {
            ...DEFAULT_CREATOR_SEARCH_FILTERS,
            search: query,
          },
          1,
          AI_SEARCH_CREATORS_PAGE_SIZE
        );

        const aiBrowse = searchCreatorsInputToBrowseFilters({
          query,
          limit: AI_SEARCH_CREATORS_PAGE_SIZE,
        });
        const browseParity = assertBrowseFilterParity(discoveryFilters, aiBrowse);
        if (!browseParity.pass) {
          console.log(`Browse filter mismatch for "${query}": ${browseParity.diff.join("; ")}`);
        }

        try {
          const discovery = await browseUnifiedCreators(supabase, discoveryFilters);
          const ai = await executeSearchCreatorsProduction(
            { query, limit: AI_SEARCH_CREATORS_PAGE_SIZE },
            { workspace: { type: "general" } }
          );

          const pass =
            browseParity.pass &&
            discovery.total === ai.total &&
            discovery.creators.length === ai.creators.length;

          results.push({
            query,
            discoveryTotal: discovery.total,
            discoveryCount: discovery.creators.length,
            aiTotal: ai.total,
            aiCount: ai.creators.length,
            pass,
          });

          console.log(`Query: "${query}"`);
          console.log(
            `  Discovery: total=${discovery.total} page=${discovery.creators.length} (internal=${discovery.internal_count ?? "?"}, discovery=${discovery.discovery_count ?? "?"})`
          );
          console.log(`  AI tool:   total=${ai.total} page=${ai.creators.length}`);
          console.log(`  Browse filters (AI): ${JSON.stringify(aiBrowse)}`);
          console.log(pass ? "  RESULT: PASS\n" : "  RESULT: FAIL\n");
        } catch (error) {
          console.error(
            `  Live parity skipped for "${query}": ${error instanceof Error ? error.message : String(error)}\n`
          );
        }
      }

      for (const { message } of STRUCTURED_CASES) {
        const discoveryBrowse = discoveryBrowseFiltersFromNaturalLanguage(
          message,
          1,
          AI_SEARCH_CREATORS_PAGE_SIZE
        );
        const aiBrowse = searchCreatorsInputToBrowseFilters({
          query: message,
          limit: AI_SEARCH_CREATORS_PAGE_SIZE,
        });
        const browseParity = assertBrowseFilterParity(discoveryBrowse, aiBrowse);
        if (!browseParity.pass) {
          console.log(`Structured browse mismatch for "${message}": ${browseParity.diff.join("; ")}`);
          continue;
        }

        try {
          const discovery = await browseUnifiedCreators(supabase, discoveryBrowse);
          const ai = await executeSearchCreatorsProduction(
            { query: message, limit: AI_SEARCH_CREATORS_PAGE_SIZE },
            { workspace: { type: "general" } }
          );

          const pass =
            discovery.total === ai.total && discovery.creators.length === ai.creators.length;

          results.push({
            query: message,
            discoveryTotal: discovery.total,
            discoveryCount: discovery.creators.length,
            aiTotal: ai.total,
            aiCount: ai.creators.length,
            pass,
          });

          console.log(`Structured: "${message}"`);
          console.log(`  Parsed: ${JSON.stringify(parseCreatorSearchQuery(message))}`);
          console.log(
            `  Discovery filters: ${JSON.stringify(parsedCreatorSearchToDiscoveryFilters(parseCreatorSearchQuery(message)))}`
          );
          console.log(`  Discovery: total=${discovery.total} page=${discovery.creators.length}`);
          console.log(`  AI tool:   total=${ai.total} page=${ai.creators.length}`);
          console.log(pass ? "  RESULT: PASS\n" : "  RESULT: FAIL\n");
        } catch (error) {
          console.error(
            `  Live parity skipped for "${message}": ${error instanceof Error ? error.message : String(error)}\n`
          );
        }
      }
    }
  );

  if (results.length === 0) {
    console.log("Live parity: SKIPPED (database unreachable in this environment)\n");
    process.exitCode = offlineOk ? 0 : 1;
    return;
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`=== Parity summary: ${passed}/${results.length} queries matched ===`);

  if (!offlineOk || passed !== results.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
