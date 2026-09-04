import assert from "node:assert/strict";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  creatorMatchesHandle,
  resolveCreatorAcrossPools,
} from "./resolve-creator-across-pools";

function stub(
  id: string,
  handle: string,
  platform = "instagram"
): UnifiedCreatorResult {
  return {
    unified_id: id,
    display_name: id,
    platforms: [
      {
        id: `${id}-p`,
        platform,
        handle,
        follower_count: null,
        engagement_rate: null,
        avg_views: null,
      } as UnifiedCreatorResult["platforms"][number],
    ],
  } as UnifiedCreatorResult;
}

const shortlist = [stub("sl-1", "ouda.5"), stub("sl-2", "karimkabbany")];
const searchPool = [stub("pool-1", "reem_elkhashab"), stub("pool-2", "ouda.5")];

assert.equal(resolveCreatorAcrossPools("missing", shortlist, searchPool), null);
assert.equal(resolveCreatorAcrossPools("reem_elkhashab", shortlist, searchPool)?.unified_id, "pool-1");
assert.equal(
  resolveCreatorAcrossPools("ouda.5", shortlist, searchPool)?.unified_id,
  "sl-1",
  "shortlist pool wins when both have the handle"
);
assert.equal(resolveCreatorAcrossPools("@KarimKabbany", shortlist)?.unified_id, "sl-2");
assert.ok(creatorMatchesHandle(shortlist[0]!, "ouda.5"));

console.log("OK — resolve-creator-across-pools");
