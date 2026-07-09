/**
 * Unit tests for DNA merge engine — tier downgrade prevention.
 * Run: npx tsx features/creator-dna/services/dna-merge-engine.test.ts
 */

import { mergeFieldCandidate, mergeTierPriority, sourceToMergeTier } from "./dna-merge-engine";
import { wrapValue } from "./field-envelope";
import type { DnaFieldCandidate } from "../types";

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

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
