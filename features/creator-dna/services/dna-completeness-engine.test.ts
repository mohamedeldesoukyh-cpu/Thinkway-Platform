/**
 * Unit tests for DNA completeness engine.
 * Run: npx tsx features/creator-dna/services/dna-completeness-engine.test.ts
 */

import { calculateDnaCompleteness } from "./dna-completeness-engine";
import { createEmptyCreatorDNADocument } from "./document-factory";
import { wrapValue } from "./field-envelope";

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
  console.log("\nDNA completeness engine unit tests\n");

  const empty = createEmptyCreatorDNADocument();
  const emptyResult = calculateDnaCompleteness(empty);
  assert("empty document scores low", emptyResult.dnaCompleteness < 20);
  assert(
    "demographics in verificationRequired",
    emptyResult.verificationRequired.includes("audience.audienceGender")
  );

  const populated = createEmptyCreatorDNADocument();
  populated.identity.displayName = wrapValue("Creator", "ipl", 0.88);
  populated.identity.bio = wrapValue("Bio text", "ipl", 0.85);
  populated.identity.avatarUrl = wrapValue("https://example.com/a.jpg", "ipl", 0.9);
  populated.identity.handle = wrapValue("@creator", "ipl", 0.88);
  populated.identity.platform = wrapValue("instagram", "ipl", 0.88);
  populated.metrics.followers = wrapValue(100_000, "ipl", 0.88);
  populated.metrics.engagementRate = wrapValue(4.5, "ipl", 0.85);
  populated.audience.categories = wrapValue(["Parenting"], "ipl", 0.8);
  populated.audience.country = wrapValue("EG", "ipl", 0.85);
  populated.scores.thinkwayScore = wrapValue(72, "ai_infer", 0.62);
  populated.meta.platformAccountIds = ["00000000-0000-4000-8000-000000000001"];

  const result = calculateDnaCompleteness(populated);
  assert("populated IPL document scores higher", result.dnaCompleteness > emptyResult.dnaCompleteness);
  assert("eight dimensions scored", Object.keys(result.dimensionScores).length === 8);
  assert("audienceGender still verification required", result.verificationRequired.includes("audience.audienceGender"));

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
