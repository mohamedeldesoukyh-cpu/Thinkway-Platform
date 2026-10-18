import assert from "node:assert/strict";
import { readRecommendationIds, recommendationRank, compareRecommendations } from "./shortlist-recommendations";
assert.deepEqual(readRecommendationIds({recommendedCreatorIds:["b","a","b",null]}),["b","a"]);
assert.equal(recommendationRank({recommendedCreatorIds:["b","a"]},"a"),2);
assert.equal(recommendationRank({},"a"),undefined);
assert.ok(compareRecommendations({recommendationRank:1},{recommendationRank:2})<0);
assert.ok(compareRecommendations({recommendationRank:2},{})<0);
console.log("shortlist recommendation metadata tests passed");
