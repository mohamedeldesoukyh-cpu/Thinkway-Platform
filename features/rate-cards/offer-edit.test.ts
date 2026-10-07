import test from "node:test";
import assert from "node:assert/strict";
import {deliverableEdit,offerEditSchema,offerScope} from "./offer-edit";
import type {RateLine} from "./model";
const line=(id:string,deliverable:string,price_type="client_price")=>({id,creator_ref:"inf:11111111-1111-4111-8111-111111111111",platform:"instagram",deliverable,price_type,amount:100,currency:"EGP"} as RateLine);
test("full offer deletion scope includes cost, selling price and extras, without another offer",()=>{
 const rows=[line("cost","instagram_reel","creator_cost"),line("price","instagram_reel"),line("usage","usage_right"),line("story","instagram_story")];
 assert.deepEqual(offerScope(rows,"price").ids,["cost","price","usage"]);
});
test("changing deliverable updates both price identities and leaves extras and amounts alone",()=>{
 const rows=[line("cost","instagram_reel","creator_cost"),line("price","instagram_reel"),line("usage","usage_right")];
 assert.deepEqual(deliverableEdit(rows,"price","instagram_story"),{ids:["cost","price"],patch:{deliverable:"instagram_story"}});
 assert.throws(()=>deliverableEdit(rows,"price","tiktok_video"));
 assert.throws(()=>deliverableEdit(rows,"missing","instagram_story"));
});
test("package edits reject fractional content counts and duplicate included platforms",()=>{
 const details={name:"Reel package",reels:1,stories:0,profiles:[{platform:"instagram",profile_url:"https://instagram.com/creator"}]};
 assert.equal(offerEditSchema.safeParse({kind:"package",details}).success,true);
 assert.equal(offerEditSchema.safeParse({kind:"package",details:{...details,reels:1.5}}).success,false);
 assert.equal(offerEditSchema.safeParse({kind:"package",details:{...details,profiles:[...details.profiles,...details.profiles]}}).success,false);
});
