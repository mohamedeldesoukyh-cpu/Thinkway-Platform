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

/**
 * Pack 05: POOL has five handles; four exist only in POOL; ouda.5 is also in CR.
 * Resolving against CR alone silently no-ops four of five — that was the last break.
 */
const CR = [stub("cr-ouda", "ouda.5"), stub("cr-karim", "karimkabbany")];
const POOL = [
  stub("pool-ahmed", "ahmed_elbadawy"),
  stub("pool-nour", "nourhanneeisa"),
  stub("pool-farah", "itsfarahhosny"),
  stub("pool-islam", "islamfawzy_"),
  stub("pool-ouda", "ouda.5"),
];

const PACK_FIVE = [
  "ahmed_elbadawy",
  "nourhanneeisa",
  "itsfarahhosny",
  "islamfawzy_",
  "ouda.5",
] as const;

assert.equal(resolveCreatorAcrossPools("missing", CR, POOL), null);

// Vacuous check that used to "pass": ouda.5 exists in CR.
assert.equal(resolveCreatorAcrossPools("ouda.5", CR)?.unified_id, "cr-ouda");

// The real check — all five open when both pools are searched.
for (const handle of PACK_FIVE) {
  const found = resolveCreatorAcrossPools(handle, CR, POOL);
  assert.ok(found, `pack handle ${handle} must resolve across CR+POOL`);
}

// Four POOL-only handles must NOT resolve against CR alone.
for (const handle of PACK_FIVE.slice(0, 4)) {
  assert.equal(
    resolveCreatorAcrossPools(handle, CR),
    null,
    `${handle} must be invisible when only CR is searched`
  );
}

// Shared handle: first pool wins (CR before POOL).
assert.equal(
  resolveCreatorAcrossPools("ouda.5", CR, POOL)?.unified_id,
  "cr-ouda",
  "shortlist/CR pool wins when both have the handle"
);

assert.equal(
  resolveCreatorAcrossPools("reem_elkhashab", CR, [stub("pool-1", "reem_elkhashab")])
    ?.unified_id,
  "pool-1"
);
assert.equal(resolveCreatorAcrossPools("@KarimKabbany", CR)?.unified_id, "cr-karim");
assert.ok(creatorMatchesHandle(CR[0]!, "ouda.5"));

console.log("OK — resolve-creator-across-pools (5/5 pack handles across CR+POOL)");
