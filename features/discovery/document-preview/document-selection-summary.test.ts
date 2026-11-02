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
test("creator rows and overall summary share original line prices, variable fees and calculated GP", () => {
 const summary=summarizeQuotationSelection(items,["a1","a2"]);
 const byLabel=Object.fromEntries(summary.metrics.map(metric=>[metric.label,metric]));
 assert.equal(summary.selectedCreatorCount,1);
 assert.equal(byLabel["Client cost"].value,"EGP 1,500");
 assert.equal(byLabel["Agency fee"].value,"EGP 200");
 assert.equal(byLabel["Total incl. AF"].value,"EGP 1,700");
 assert.equal(byLabel["Creator cost"].value,"EGP 1,000");
 assert.equal(byLabel["Gross profit"].value,"EGP 700");
 assert.equal(byLabel["Margin"].value,"41.2%");
 assert.equal(byLabel["Total incl. AF"].scope,"client");
 assert.equal(byLabel["Gross profit"].scope,"internal");
});
test("foreign IDs cannot contribute to selection summaries", () => {
 const summary=summarizeQuotationSelection(items,["unknown"]);
 assert.equal(summary.selectedCreatorCount,0);
 assert.equal(summary.metrics.find(metric=>metric.label==="Client cost")?.value,"EGP 0");
});

test("selector preserves native currencies and converts EGP before applying a currency label", () => {
 const rows = [
  { id:"aed", unified_id:"a", cost_currency:"AED", revenue:4000, af_value:400, cost:3000, gp_value:1000, revenue_egp:62000, af_value_egp:6200, cost_egp:46500, gp_value_egp:15500 },
  { id:"usd", unified_id:"b", cost_currency:"USD", revenue:6500, af_value:0, cost:5500, gp_value:1000, revenue_egp:338000, af_value_egp:0, cost_egp:286000, gp_value_egp:52000 },
 ] as QuotationItemRow[];
 const metrics = (ids:string[], native:boolean, rate?:number) => Object.fromEntries(summarizeQuotationSelection(rows, ids, "AED", {showOriginalCurrency:native,displayFxRateToEgp:rate}).metrics.map(m=>[m.label,m.value]));
 assert.equal(metrics(["aed"],true)["Client cost"],"AED 4,000");
 assert.equal(metrics(["aed","usd"],true)["Total incl. AF"],"AED 4,400 · USD 6,500");
 assert.equal(metrics(["aed","usd"],true)["Gross profit"],"AED 1,400 · USD 1,000");
 assert.equal(metrics(["aed"],false,15.5)["Client cost"],"AED 4,000");
 assert.equal(metrics(["aed"],false)["Client cost"],"EGP 62,000");
 assert.equal(metrics(["usd"],true)["Client cost"],"USD 6,500");
});

test("converted selection total combines mixed currencies and follows the selected lines", () => {
 const rows = [
  {id:"aed",unified_id:"a",cost_currency:"AED",revenue:1000,af_value:100,revenue_egp:14000,af_value_egp:1400,cost_egp:7000},
  {id:"usd",unified_id:"b",cost_currency:"USD",revenue:500,af_value:50,revenue_egp:25000,af_value_egp:2500,cost_egp:15000},
 ] as QuotationItemRow[];
 const values=(ids:string[],currency:string,rate:number)=>Object.fromEntries(summarizeQuotationSelection(rows,ids,currency,{displayFxRateToEgp:rate}).metrics.map(metric=>[metric.label,metric.value]));
 assert.equal(values(["aed","usd"],"EGP",1)["Total incl. AF"],"EGP 42,900");
 assert.equal(values(["aed","usd"],"USD",50)["Client cost"],"USD 780");
 assert.equal(values(["aed","usd"],"USD",50)["Agency fee"],"USD 78");
 assert.equal(values(["aed","usd"],"USD",50)["Total incl. AF"],"USD 858");
 assert.equal(values(["aed"],"USD",50)["Total incl. AF"],"USD 308");
 assert.equal(values([],"AED",14)["Total incl. AF"],"AED 0");
});
