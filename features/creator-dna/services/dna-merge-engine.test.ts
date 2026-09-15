/**
 * Unit tests for DNA merge engine — tier downgrade prevention.
 * Run: npx tsx features/creator-dna/services/dna-merge-engine.test.ts
 */

import { mergeCandidatesIntoDocument, mergeFieldCandidate, mergeTierPriority, sourceToMergeTier } from "./dna-merge-engine";
import { wrapValue } from "./field-envelope";
import type { DnaFieldCandidate } from "../types";
import { createEmptyCreatorDNADocument } from "./document-factory";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function runTests(): void {
  console.log("\nDNA merge engine unit tests\n");

  assert("verified tier beats imported", mergeTierPriority("verified") > mergeTierPriority("imported"));
  assert("imported tier beats inferred", mergeTierPriority("imported") > mergeTierPriority("inferred"));
  assert("manual maps to verified", sourceToMergeTier("manual", true) === "verified");
  assert("ipl maps to imported", sourceToMergeTier("ipl", true) === "imported");

  const verifiedCurrent = wrapValue("Verified Name", "manual", 1.0, {
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const inferredCandidate: DnaFieldCandidate<string | null> = {
    path: "identity.displayName",
    value: "AI Guess",
    confidence: 0.99,
    source: "ai_infer",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };

  const merged = mergeFieldCandidate(verifiedCurrent, inferredCandidate);
  assert("never overwrite verified with inferred", merged.value === "Verified Name");
  assert("verified source preserved", merged.source === "manual");

  const emptyCandidate: DnaFieldCandidate<string | null> = {
    path: "identity.displayName",
    value: null,
    confidence: 0,
    source: "ai_infer",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };

  const emptyMerge = mergeFieldCandidate(verifiedCurrent, emptyCandidate);
  assert("empty incoming does not clear verified", emptyMerge.value === "Verified Name");

  const document = createEmptyCreatorDNADocument();
  document.content.recentPublications = wrapValue(
    [{ platformPostId: "post-1", url: "https://instagram.test/p/one", caption: "Verified caption", thumbnail: null, likes: 1, comments: 1, views: null, posted_at: null }],
    "manual",
    1,
    { updatedAt: "2026-01-01T00:00:00.000Z" }
  );
  mergeCandidatesIntoDocument(document, [{
    path: "content.recentPublications",
    value: [{ platformPostId: "post-1", url: "https://instagram.test/p/one", caption: null, thumbnail: null, likes: null, comments: null, views: 99, posted_at: null, paidPartnership: true, source: { provider: "apify", apifyRunId: "run-1", apifyDatasetId: "dataset-1", platformPostId: "post-1", capturedAt: "2026-02-01T00:00:00.000Z" } }],
    confidence: 0.7,
    source: "ipl",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }]);
  const publication = document.content.recentPublications.value[0];
  assert("publication evidence fills missing metadata under stronger authority", publication?.paidPartnership === true && publication?.views === 99);
  assert("publication evidence preserves stronger existing values and envelope source", publication?.caption === "Verified caption" && document.content.recentPublications.source === "manual");

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
