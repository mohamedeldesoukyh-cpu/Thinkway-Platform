import test from "node:test";
import assert from "node:assert/strict";
import {rateTemplateRows} from "./template-rows";
import type {RateLine} from "./model";
function rate(id:string,deliverable:string,price_type="creator_cost",amount=100){return {id,creator_ref:"a",platform:"instagram",deliverable,price_type,amount} as RateLine;}
test("upload-shaped row keeps reel, usage, boosting and attendance in distinct price fields",()=>{
 const rates=[rate("1","instagram_reel"),rate("2","instagram_reel","client_price",130),rate("3","usage_right"),rate("4","usage_right","client_price",0),rate("5","boosting"),rate("6","event_attendance","client_price",200)];
 const [row]=rateTemplateRows(rates);assert.equal(rateTemplateRows(rates).length,1);assert.equal(row.base.client?.amount,130);assert.equal(row.usage.client?.amount,0);assert.equal(row.boost.client,undefined);assert.equal(row.event.client?.amount,200);assert.equal(row.ids.length,6);
});
test("additional content types do not repeat or lose shared extra charges",()=>{
 const rows=rateTemplateRows([rate("1","instagram_reel"),rate("2","instagram_story"),rate("3","boosting")]);assert.equal(rows.length,2);assert.equal(rows.filter(r=>r.boost.cost).length,1);assert.deepEqual(rows.flatMap(r=>r.ids).sort(),["1","2","3"]);
});
test("add-ons only and different platforms remain distinct",()=>{
 const rows=rateTemplateRows([rate("1","boosting"),{...rate("2","boosting"),platform:"tiktok"}]);assert.equal(rows.length,2);assert.equal(rows[0].type,"");assert.equal(rows[0].base.cost,undefined);assert.equal(rows[0].boost.cost?.id,"1");
});
