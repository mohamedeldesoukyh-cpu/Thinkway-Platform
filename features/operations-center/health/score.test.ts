import assert from "node:assert/strict";
import test from "node:test";

import { calculateOverallHealthScore, statusFromScore } from "./score";

test("calculateOverallHealthScore is weighted average 0–100", () => {
  const score = calculateOverallHealthScore([
    { id: "a", weight: 2, status: "healthy", score: 100 },
    { id: "b", weight: 1, status: "warning", score: 70 },
  ]);
  assert.equal(score, Math.round((200 + 70) / 3));
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
