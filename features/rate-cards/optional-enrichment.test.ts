import test from "node:test";
import assert from "node:assert/strict";
import {optionalEnrichment} from "../../lib/creators/optional-enrichment";

test("queue quota errors do not prevent continuing with a resolved creator", async () => {
  const result = await optionalEnrichment(async () => { throw new Error("ERR max requests limit exceeded"); });
  assert.equal(result, null);
});
test("unsuccessful queue results remain unsuccessful, not completed", async () => {
  const result = await optionalEnrichment(async () => ({ok:false, queued:false}));
  assert.deepEqual(result, {ok:false, queued:false});
});
test("successful queue admission is preserved", async () => {
  assert.deepEqual(await optionalEnrichment(async () => ({queued:true})), {queued:true});
});
