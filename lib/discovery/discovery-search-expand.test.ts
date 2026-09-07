import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  isCuratedTransliterationTerm,
  resolveDiscoverySearchAliases,
  shouldExpandDiscoverySearchTerm,
} from "@/lib/discovery/discovery-search-aliases";
import {
  buildDiscoverySearchOrQuery,
  prepareDiscoverySearchQuery,
} from "@/lib/discovery/discovery-search-expand";
import { normalizeDiscoverySearchText } from "@/lib/discovery/discovery-search-normalize";
import {
  isExactCreatorLookupSearch,
  normalizeDiscoverySearchQuery,
} from "@/lib/discovery/creator-search-query";

test("Arabic diacritics and character variants normalize consistently", () => {
  const withHarakat = "مَطَاعِم";
  const alefVariants = "مطاعم";
  assert.equal(
    normalizeDiscoverySearchText(withHarakat),
    normalizeDiscoverySearchText(alefVariants)
  );
  assert.equal(normalizeDiscoverySearchText("موضة"), normalizeDiscoverySearchText("موضه"));
  assert.equal(normalizeDiscoverySearchText("أزياء"), normalizeDiscoverySearchText("ازياء"));
  assert.equal(normalizeDiscoverySearchText("رياضة"), normalizeDiscoverySearchText("رياضه"));
});

test("whitespace and punctuation normalize; Latin lowercased", () => {
  assert.equal(normalizeDiscoverySearchText("  Beauty!!!  "), "beauty");
  assert.equal(normalizeDiscoverySearchText("food\t\tblogger"), "food blogger");
});

test("handles and URLs stay exact — no synonym expansion", () => {
  const handle = prepareDiscoverySearchQuery("@SomeCreator_01");
  assert.equal(handle.exactLookup, true);
  assert.equal(handle.expanded, false);
  assert.equal(handle.expansions.length, 0);
  assert.equal(handle.rpcQuery, "@somecreator_01");

  const url = prepareDiscoverySearchQuery("https://www.instagram.com/SomeCreator_01/");
  assert.equal(url.exactLookup, true);
  assert.equal(url.expanded, false);
  assert.ok(url.rpcQuery.startsWith("@"));
  assert.equal(isExactCreatorLookupSearch("https://instagram.com/x"), true);
});

test("Arabic exact term expands to English/Latin equivalents", () => {
  const prepared = prepareDiscoverySearchQuery("مطاعم");
  assert.equal(prepared.exactLookup, false);
  assert.equal(prepared.expanded, true);
  assert.ok(prepared.expansions.some((t) => t === "food"));
  assert.ok(prepared.expansions.some((t) => /mat3am|mataam|matam|restaurant/i.test(t)));
  assert.match(prepared.rpcQuery, / OR /);
  assert.match(prepared.rpcQuery, /مطاعم/);
});

test("Arabic/Latin transliteration expands (mat3am → مطاعم)", () => {
  assert.equal(isCuratedTransliterationTerm("mat3am"), true);
  const prepared = prepareDiscoverySearchQuery("mat3am");
  assert.equal(prepared.expanded, true);
  assert.ok(prepared.expansions.some((t) => t.includes("مطاعم")));
  assert.ok(prepared.expansions.some((t) => t === "food"));
});

test("English niche alias expands; canonical category label does not", () => {
  assert.equal(shouldExpandDiscoverySearchTerm("beauty"), false);
  assert.equal(shouldExpandDiscoverySearchTerm("food"), false);
  const beauty = prepareDiscoverySearchQuery("beauty");
  assert.equal(beauty.expanded, false);
  assert.equal(beauty.rpcQuery, "beauty");

  assert.equal(shouldExpandDiscoverySearchTerm("foodie"), true);
  const foodie = prepareDiscoverySearchQuery("foodie");
  assert.equal(foodie.expanded, true);
  assert.ok(foodie.expansions.some((t) => t === "food"));
  assert.ok(foodie.expansions.some((t) => t.includes("مطاعم") || t.includes("طبخ")));
});

test("known category Arabic maps to Food cluster aliases", () => {
  const aliases = resolveDiscoverySearchAliases(
    normalizeDiscoverySearchText("مطاعم")
  );
  assert.ok(aliases.length > 0);
  assert.ok(aliases.some((t) => t === "food"));
  assert.ok(!aliases.some((t) => t === "halaweyat"), "desserts must not ride restaurant expand");
});

test("mixed Arabic/English multi-word does not OR-expand (false-positive guard)", () => {
  const mixed = prepareDiscoverySearchQuery("egyptian مطاعم");
  assert.equal(mixed.expanded, false);
  assert.ok(!mixed.rpcQuery.includes(" OR "));
});

test("unrelated terms do not false-expand", () => {
  const name = prepareDiscoverySearchQuery("mohamed");
  assert.equal(name.expanded, false);
  assert.equal(name.expansions.length, 0);

  const nonsense = prepareDiscoverySearchQuery("xyzzy123");
  assert.equal(nonsense.expanded, false);
});

test("OR builder is deterministic and capped", () => {
  const once = buildDiscoverySearchOrQuery("مطاعم", ["food", "mat3am", "food", "restaurant"]);
  const twice = buildDiscoverySearchOrQuery("مطاعم", ["food", "mat3am", "food", "restaurant"]);
  assert.equal(once, twice);
  assert.ok(once.split(" OR ").length <= 6);
});

test("normalizeDiscoverySearchQuery still maps URLs and normalizes thematic text", () => {
  assert.equal(
    normalizeDiscoverySearchQuery("https://www.tiktok.com/@Foo.Bar"),
    "@foo.bar"
  );
  assert.equal(normalizeDiscoverySearchQuery("مَطَاعِم"), normalizeDiscoverySearchText("مطاعم"));
});

test("Phase 3A modules stay in-memory (no supabase / embeddings / llm)", () => {
  for (const rel of [
    "lib/discovery/discovery-search-aliases.ts",
    "lib/discovery/discovery-search-expand.ts",
    "lib/discovery/discovery-search-normalize.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    assert.doesNotMatch(source, /createClient|from\("@\/lib\/supabase|from '@\/lib\/supabase/);
    assert.doesNotMatch(source, /\.rpc\(/);
    assert.doesNotMatch(source, /pgvector|openai|anthropic|@xenova\/transformers/);
  }
});

test("unified-browse wires prepareDiscoverySearchQuery before FTS", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/creators/unified-browse.ts"),
    "utf8"
  );
  assert.match(source, /prepareDiscoverySearchQuery/);
  const fnStart = source.indexOf("async function resolveCreatorSearchHits");
  assert.ok(fnStart > 0);
  const slice = source.slice(fnStart, fnStart + 1200);
  assert.match(slice, /prepareDiscoverySearchQuery/);
  assert.match(slice, /searchCreators/);
  // Unfiltered span must not call prepare/expand.
  const unfilteredStart = source.indexOf('perf?.span("fast_unfiltered_browse")');
  const unfilteredEnd = source.indexOf('perf?.span("fts_browse_fill")', unfilteredStart);
  const unfiltered = source.slice(unfilteredStart, unfilteredEnd);
  assert.doesNotMatch(unfiltered, /prepareDiscoverySearchQuery/);
});

test("Phase 2 rank weights file untouched by expansion imports", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/creators/unified-ranking.ts"),
    "utf8"
  );
  assert.doesNotMatch(source, /discovery-search-expand|discovery-search-aliases/);
});
