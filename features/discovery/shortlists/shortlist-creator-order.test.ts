import assert from "node:assert/strict";
import { orderShortlistCreators, tierOrderShortlistCreators } from "./shortlist-creator-order";
import type { ShortlistCreatorItem } from "./types";
const items = ["a","b","new"].map(item_id=>({item_id,creator:null})) as ShortlistCreatorItem[];
assert.deepEqual(orderShortlistCreators(items,["b","a"]).map(item=>item.item_id),["b","a","new"]);
assert.deepEqual(orderShortlistCreators(items,[]),items);
assert.deepEqual(orderShortlistCreators(items,["deleted","b"]).map(item=>item.item_id),["b","a","new"]);
assert.deepEqual(tierOrderShortlistCreators(items),items,"Unknown tiers retain stable order");
console.log("shortlist creator order tests passed");
