import assert from "node:assert/strict";
import { test } from "node:test";
import { quotationOptionDescription } from "./quotation-line-options";
import type { QuotationItemRow } from "@/features/quotations/types";
const reel = {type:"instagram_reel",quantity:1,platform:"instagram",service_description:"1× IG Reel"};
const description = (deliverables: unknown[], service_description: string) => quotationOptionDescription({deliverables,service_description} as Pick<QuotationItemRow,"deliverables"|"service_description">);
test("option summary does not repeat generated text from both saved description levels",()=>{
  assert.equal(description([reel],"1× IG Reel — 1× IG Reel"),"1× IG Reel (instagram)");
});
test("additional notes are preserved once, including duration and rights",()=>{
  assert.equal(description([{...reel,service_description:"1× IG Reel — Usage rights: 3 months"}],"1× IG Reel — Usage rights: 3 months — Exclusivity: 2 weeks"),"1× IG Reel (instagram) — Usage rights: 3 months — Exclusivity: 2 weeks");
});
test("distinct platform deliverables and their quantities remain visible",()=>{
  const result=description([reel,{...reel,platform:"tiktok",quantity:2,type_lines:[{type:"instagram_reel",quantity:2}],service_description:""}],"");
  assert.equal(result,"1× IG Reel (instagram), 2× IG Reel (tiktok)");
});
test("free-text-only services remain intact and repeated notes are deduplicated",()=>{
  assert.equal(description([],"On-site attendance — On-site attendance"),"On-site attendance");
  assert.equal(description([reel]," 1×  IG Reel (Instagram) "),"1× IG Reel (instagram)");
});
test("an extra duration on an auto-filled summary is retained without repeating the summary",()=>{
  assert.equal(description([reel],"1× IG Reel 2 weeks"),"1× IG Reel (instagram) — 2 weeks");
});

