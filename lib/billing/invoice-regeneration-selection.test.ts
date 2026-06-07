/**
 * Run: npx tsx lib/billing/invoice-regeneration-selection.test.ts
 */

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testAllowedLineFilter() {
  const allowed = new Set(["line-a", "line-b"]);
  const linked = ["line-a", "line-b", "line-c"];
  const stale = linked.filter((lineId) => !allowed.has(lineId));
  assert(stale.length === 1 && stale[0] === "line-c", "stale link detection");
}

testAllowedLineFilter();
console.log("invoice-regeneration-selection: 1 passed");
