import test from "node:test";
import assert from "node:assert/strict";
import { visibleAdTracks, PARENT_TRACK_TO_CHILD_FIELD } from "./assignment-css-grid";
test("ad live date, month, invoice and actions do not depend on parent GP or margin visibility", () => {
  const selected=new Set(["type","postDate","liveAdMonth","invoice","workflow"]);
  const tracks=visibleAdTracks(field=>selected.has(field));
  for(const track of ["assignment","gp","margin","opsStatus","actions"]) assert.ok(tracks.includes(track));
  assert.ok(!tracks.includes("cost")); assert.ok(!tracks.includes("revenue"));
});
test("each selected child column remains visible and hidden child financials stay hidden", () => {
  for(const field of Object.values(PARENT_TRACK_TO_CHILD_FIELD).filter(field=>field!=="fullDescriptionSpacer")) {
    assert.ok(visibleAdTracks(candidate=>candidate===field).some(track=>PARENT_TRACK_TO_CHILD_FIELD[track]===field));
  }
  assert.deepEqual(visibleAdTracks(()=>false),["actions"]);
  assert.ok(visibleAdTracks(field=>field==="collection").includes("billing"));
});
