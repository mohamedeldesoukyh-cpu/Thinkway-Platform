import assert from "node:assert/strict";
import test from "node:test";
import { packageReviewGroups } from "./package-review-groups";
const make = (type: string, quantity = 1, lineId = "line", packageMode = true) => Array.from({length: quantity}, (_,i) => ({key:`${lineId}:${type}:${i+1}`, lineId, type, label:type, quantity, sequence:quantity>1?i+1:null, package:packageMode}));
test("a four-component package is one review and two packages produce exactly two", () => {
  for (const count of [1,2,3]) {
    const groups = packageReviewGroups(["ig_reel","ig_story","mirrored_tt","boosting"].flatMap(type => make(type,count)));
    assert.equal(new Set([...groups.values()].map(v=>v.reviewGroupKey)).size,count);
  }
});
test("story sets and mirrored platforms do not inflate original package counts", () => {
  const groups = packageReviewGroups([...make("boosting"),...make("ig_story",4),...make("ig_reel",2),...make("mirrored_tt",2)]);
  assert.equal(new Set([...groups.values()].map(v=>v.reviewGroupKey)).size,2);
  assert.equal(groups.get("line:ig_story:2")?.reviewGroupKey,groups.get("line:ig_reel:1")?.reviewGroupKey);
});
test("separate assignments and per-deliverable prices never collapse together", () => {
  const groups = packageReviewGroups([...make("ig_reel"),...make("ig_story"),...make("ig_reel",1,"other"),...make("ig_story",1,"other"),...make("ig_story",2,"individual",false)]);
  assert.equal(new Set([...groups.values()].map(v=>v.reviewGroupKey)).size,2);
  assert.equal(groups.has("individual:ig_story:1"),false);
});
