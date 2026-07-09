/**
 * Unit tests for Creator DNA conflict resolution.
 * Run: npx tsx features/creator-dna/services/conflict-resolver.test.ts
 */

import { compositeScore, resolveConflicts, sourcePriority } from "./conflict-resolver";
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
  console.log("\nConflict resolver unit tests\n");

  assert("manual beats ipl on priority", sourcePriority("manual") > sourcePriority("ipl"));
  assert("oauth beats ai_infer", sourcePriority("oauth") > sourcePriority("ai_infer"));
  assert("campaign beats ipl", sourcePriority("campaign") > sourcePriority("ipl"));

  const manualScore = compositeScore({ source: "manual", confidence: 0.7 });
  const iplHighScore = compositeScore({ source: "ipl", confidence: 0.99 });
  assert(
    "manual wins over high-confidence ipl",
    manualScore > iplHighScore,
    `manual=${manualScore}, ipl=${iplHighScore}`
  );

  const current = wrapValue("Old Name", "ipl", 0.88, {
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const manualCandidate: DnaFieldCandidate<string | null> = {
    path: "identity.displayName",
    value: "Manual Override",
    confidence: 0.95,
    source: "manual",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };

  const resolved = resolveConflicts(current, [manualCandidate]);
  assert("manual candidate wins conflict", resolved.value === "Manual Override");
  assert("manual source preserved", resolved.source === "manual");
  assert("history recorded", resolved.history.length >= 2);

  const newerIpl: DnaFieldCandidate<string | null> = {
    path: "identity.displayName",
    value: "Newer IPL",
    confidence: 0.99,
    source: "ipl",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };

  const manualCurrent = wrapValue("Manual Name", "manual", 1.0, {
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const resolved2 = resolveConflicts(manualCurrent, [newerIpl]);
  assert(
    "manual current beats newer high-confidence ipl",
    resolved2.value === "Manual Name" && resolved2.source === "manual"
  );

  const aiCandidate: DnaFieldCandidate<string | null> = {
    path: "identity.displayName",
    value: "AI Guess",
    confidence: 0.99,
    source: "ai_infer",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };

  const iplCandidate: DnaFieldCandidate<string | null> = {
    path: "identity.displayName",
    value: "IPL Value",
    confidence: 0.85,
    source: "ipl",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const resolved3 = resolveConflicts(undefined, [aiCandidate, iplCandidate]);
  assert("ipl beats ai_infer despite ai being newer", resolved3.source === "ipl");

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
