import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScoreBreakdown,
  calculateOverallHealthScore,
  statusFromScore,
} from "./score";

test("calculateOverallHealthScore is weighted average 0–100", () => {
  const score = calculateOverallHealthScore([
    { id: "a", weight: 2, status: "healthy", score: 100 },
    { id: "b", weight: 1, status: "warning", score: 70 },
  ]);
  assert.equal(score, Math.round((200 + 70) / 3));
});

test("buildScoreBreakdown exposes per-adapter contribution", () => {
  const { breakdown, totalWeight, overall } = buildScoreBreakdown([
    { id: "nextjs", name: "Next.js", weight: 10, status: "healthy", score: 100 },
    { id: "redis", name: "Redis", weight: 10, status: "warning", score: 70 },
  ]);
  assert.equal(totalWeight, 20);
  assert.equal(overall, 85);
  assert.equal(breakdown.length, 2);
  assert.equal(breakdown[0]?.contribution, 10);
  assert.equal(breakdown[1]?.contribution, 7);
});

test("empty components score 0", () => {
  assert.equal(calculateOverallHealthScore([]), 0);
});

test("offline pulls score down", () => {
  const score = calculateOverallHealthScore([
    { id: "redis", weight: 1.5, status: "offline", score: 0 },
    { id: "app", weight: 1, status: "healthy", score: 100 },
  ]);
  assert.ok(score < 50);
});

test("statusFromScore bands", () => {
  assert.equal(statusFromScore(90), "healthy");
  assert.equal(statusFromScore(70), "warning");
  assert.equal(statusFromScore(40), "critical");
  assert.equal(statusFromScore(0), "offline");
});
