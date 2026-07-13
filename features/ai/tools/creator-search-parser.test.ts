import assert from "node:assert/strict";

import { parseCreatorSearchQuery } from "./creator-search-parser";

function tier(query: string): { min?: number; max?: number } {
  const parsed = parseCreatorSearchQuery(query);
  return { min: parsed.minFollowers, max: parsed.maxFollowers };
}

// Temporal / phase phrases must NEVER be read as follower tiers.
// Regression for: "Mid July" → Mid tier → spurious 100k–499k filter.
function testTemporalWordsDoNotTrigger(): void {
  const negatives = [
    "Launch mid July across TikTok",
    "Campaign launches Mid August",
    "mid campaign check-in",
    "review at mid phase",
    "post in mid month",
    "publish mid week",
    "focus on mid funnel conversions",
    "kickoff early July, live mid September",
    // The exact e& brief fragment that produced the bug:
    "We have an upcoming summer campaign for e&, launch Mid July, budget EGP 1M on TikTok",
  ];
  for (const q of negatives) {
    const t = tier(q);
    assert.equal(t.min, undefined, `should NOT infer a follower tier from: "${q}" (got min=${t.min})`);
    assert.equal(t.max, undefined, `should NOT infer a follower tier from: "${q}" (got max=${t.max})`);
  }
}

// Explicit creator/tier context SHOULD infer the follower tier.
function testCreatorContextTriggers(): void {
  const cases: Array<[string, number, number]> = [
    ["mid-tier creators on TikTok", 100_000, 499_999],
    ["looking for mid influencers", 100_000, 499_999],
    ["mid creators", 100_000, 499_999],
    ["mix of mid and macro", 100_000, 499_999], // first matching tier in range order
    ["macro creators please", 500_000, 999_999],
    ["micro-tier", 10_000, 99_999],
    ["mostly nano influencers", 1_000, 9_999],
    ["mid to macro range", 100_000, 499_999],
  ];
  for (const [q, min, max] of cases) {
    const t = tier(q);
    assert.equal(t.min, min, `expected min=${min} for: "${q}" (got ${t.min})`);
    assert.equal(t.max, max, `expected max=${max} for: "${q}" (got ${t.max})`);
  }
}

function run(): void {
  testTemporalWordsDoNotTrigger();
  testCreatorContextTriggers();
  console.log("creator-search-parser.test.ts: PASS");
}

run();
