import assert from "node:assert/strict";

import { withTimeBudget } from "@/lib/creators/with-time-budget";

async function main() {
  const fast = await withTimeBudget(Promise.resolve("ok"), 50, "fallback");
  assert.equal(fast, "ok");

  const slow = await withTimeBudget(
    new Promise<string>((resolve) => {
      setTimeout(() => resolve("late"), 80);
    }),
    20,
    "fallback"
  );
  assert.equal(slow, "fallback");

  const rejected = await withTimeBudget(
    Promise.reject(new Error("boom")),
    50,
    "fallback"
  );
  assert.equal(rejected, "fallback");

  console.log("lib/creators/with-time-budget.test.ts — all tests passed");
}

void main();
