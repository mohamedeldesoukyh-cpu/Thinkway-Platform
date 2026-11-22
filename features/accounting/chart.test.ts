import assert from "node:assert/strict";
import { CHART, chartCsv, isWithin } from "./chart";

assert.equal(new Set(CHART.map(a => a.code)).size, CHART.length, "Account codes must be unique");
for (const account of CHART) {
  assert.match(account.code, /^\d{6}$/);
  if (account.parent) {
    assert.equal(CHART.find(a => a.code === account.parent)?.kind, "Group", `${account.code} needs a summary parent`);
    const chain = new Set([account.code]);
    let parent = account.parent;
    while (parent) {
      assert.ok(!chain.has(parent), "Account hierarchy must not contain cycles");
      chain.add(parent);
      parent = CHART.find(a => a.code === parent)?.parent ?? "";
    }
  }
  if (account.kind === "Control") assert.ok(account.subledger);
}
for (const suffix of ["001", "002", "003", "004"]) {
  const expense = CHART.find(a => a.code === `633${suffix}`)!;
  assert.equal(expense.normal, "Debit");
  assert.equal(CHART.find(a => a.code === `159${suffix}`)?.normal, "Credit");
  assert.ok(isWithin(expense, "600000"));
  assert.ok(isWithin(expense, "630000"));
  assert.ok(!isWithin(expense, "100000"));
}
assert.equal(CHART.find(a => a.code === "322001")?.kind, "System");
assert.equal(CHART.find(a => a.code === "421001")?.normal, "Debit");
assert.equal(CHART.find(a => a.code === "711001")?.type, "Revenue");
assert.ok(chartCsv(CHART).includes('"121001","Trade Accounts Receivable"'));
console.log(`PASS: ${CHART.length} accounts; hierarchy, control accounts, depreciation pairs and CSV verified.`);
