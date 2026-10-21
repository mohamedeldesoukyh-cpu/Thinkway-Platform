import assert from "node:assert/strict";
import { orderShortlistCreators, tierOrderShortlistCreators } from "./shortlist-creator-order";
import type { ShortlistCreatorItem } from "./types";
const items = ["a","b","new"].map(item_id=>({item_id,creator:null})) as ShortlistCreatorItem[];
assert.deepEqual(orderShortlistCreators(items,["b","a"]).map(item=>item.item_id),["b","a","new"]);
assert.deepEqual(orderShortlistCreators(items,[]),items);
assert.deepEqual(orderShortlistCreators(items,["deleted","b"]).map(item=>item.item_id),["b","a","new"]);
assert.deepEqual(tierOrderShortlistCreators(items),items,"Unknown tiers retain stable order");
console.log("shortlist creator order tests passed");

const starred = items.map((item,index) => ({...item,recommendationRank:index===2?1:index===0?2:undefined}));
assert.deepEqual(orderShortlistCreators(starred).map(item=>item.item_id),["new","a","b"]);
assert.deepEqual(orderShortlistCreators(starred,["b","a","new"]).map(item=>item.item_id),["b","a","new"]);
assert.equal(orderShortlistCreators(starred,["b","a","new"])[2].recommendationRank,1,"Manual order keeps stars");

const ugcItems = [
  { item_id: "ugc", recommendationRank: 1, creator: { categories: ["UGC"], platforms: [] } },
  { item_id: "regular", creator: { categories: ["Beauty"], platforms: [] } },
] as unknown as ShortlistCreatorItem[];
assert.deepEqual(orderShortlistCreators(ugcItems).map(item => item.item_id), ["regular", "ugc"], "UGC goes last even when recommended");
assert.deepEqual(orderShortlistCreators(ugcItems, ["ugc", "regular"]).map(item => item.item_id), ["ugc", "regular"], "Explicit order wins over UGC default");
