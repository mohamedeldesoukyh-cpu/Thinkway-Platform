import assert from "node:assert/strict";

import {
  rankDuplicateResults,
  scoreBrandDuplicate,
  scoreClientDuplicate,
} from "@/features/quotations/duplicate-search";

// 4. duplicate suggestion rendering (scoring)
const exactClient = scoreClientDuplicate("Unilever", {
  id: "c1",
  name: "Unilever",
  legal_name: "Unilever PLC",
  document_number: "CLI-000001",
  agency_or_direct: "agency",
});
assert.ok(exactClient);
assert.equal(exactClient.matchType, "exact");
assert.equal(exactClient.score, 100);

const fuzzyClient = scoreClientDuplicate("Unilevr", {
  id: "c2",
  name: "Unilever",
  legal_name: null,
  document_number: "CLI-000002",
  agency_or_direct: "agency",
});
assert.ok(fuzzyClient);
assert.equal(fuzzyClient.matchType, "fuzzy");

const legalMatch = scoreClientDuplicate("Unilever PLC", {
  id: "c3",
  name: "Unilever Middle East",
  legal_name: "Unilever PLC",
  document_number: "CLI-000003",
  agency_or_direct: "direct",
});
assert.ok(legalMatch);
assert.equal(legalMatch.matchType, "legal_name");

const aliasMatch = scoreClientDuplicate("يونilever", {
  id: "c4",
  name: "Unilever",
  legal_name: null,
  document_number: "CLI-000004",
  agency_or_direct: "agency",
  name_ar: "يونilever",
});
assert.ok(aliasMatch);
assert.equal(aliasMatch.matchType, "alias");

const brandExact = scoreBrandDuplicate("Dove", {
  id: "b1",
  name: "Dove",
  document_number: "BRD-000001",
  client_id: "c1",
});
assert.ok(brandExact);
assert.equal(brandExact.matchType, "exact");

const ranked = rankDuplicateResults([
  { id: "a", score: 70 },
  { id: "b", score: 95 },
]);
assert.equal(ranked[0]?.id, "b");

console.log("duplicate-search.test.ts: all assertions passed");
