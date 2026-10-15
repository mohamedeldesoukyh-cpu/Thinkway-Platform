import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeQuotationSelection, summarizeShortlistSelection } from "./document-selection-summary";
import type { QuotationItemRow } from "@/features/quotations/types";
const items = [
 { id: "a1", unified_id:"a", creator_name:"Alpha", revenue_egp:1000, af_value_egp:150, cost_egp:700, gp_value_egp:450 },
 { id: "a2", unified_id:"a", creator_name:"Alpha", revenue_egp:500, af_value_egp:50, cost_egp:300, gp_value_egp:250 },
 { id: "b", unified_id:"b", creator_name:"Beta", revenue_egp:300, af_value_egp:0, cost_egp:200, gp_value_egp:100 },
] as QuotationItemRow[];
test("empty export selection has zero totals instead of silently summarizing everyone", () => {
 const summary = summarizeQuotationSelection(items, []);
 assert.equal(summary.selectedCreatorCount,0); assert.equal(summary.totalCreatorCount,2);
 for (const metric of summary.metrics.filter(metric => metric.scope)) assert.match(metric.value, /^(EGP 0|0\.0%)$/);
 assert.equal(summarizeShortlistSelection([], []).selectedCreatorCount,0);
});
test("creator rows and overall summary share original line prices, variable fees and stored GP", () => {
 const summary=summarizeQuotationSelection(items,["a1","a2"]);
 const byLabel=Object.fromEntries(summary.metrics.map(metric=>[metric.label,metric]));
 assert.equal(summary.selectedCreatorCount,1);
 assert.equal(byLabel["Client cost"].value,"EGP 1,500");
 assert.equal(byLabel["Agency fee"].value,"EGP 200");
 assert.equal(byLabel["Total incl. AF"].value,"EGP 1,700");
 assert.equal(byLabel["Creator cost"].value,"EGP 1,000");
 assert.equal(byLabel["Gross profit"].value,"EGP 700");
 assert.equal(byLabel["Margin"].value,"46.7%");
 assert.equal(byLabel["Total incl. AF"].scope,"client");
 assert.equal(byLabel["Gross profit"].scope,"internal");
});
test("foreign IDs cannot contribute to selection summaries", () => {
 const summary=summarizeQuotationSelection(items,["unknown"]);
 assert.equal(summary.selectedCreatorCount,0);
 assert.equal(summary.metrics.find(metric=>metric.label==="Client cost")?.value,"EGP 0");
});
