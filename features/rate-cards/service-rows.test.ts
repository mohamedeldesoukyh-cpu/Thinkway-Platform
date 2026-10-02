import test from "node:test";
import assert from "node:assert/strict";
import {rateServiceRows} from "./service-rows";
import type {RateLine} from "./model";
import {RATE_UPLOAD_MAX_BYTES,validRateUploadPath} from "./upload-limits";
test("pair creator and client rates for every service, preserving zero and missing prices",()=>{
 const lines=[{id:"1",creator_ref:"a",platform:"instagram",deliverable:"boosting",price_type:"creator_cost",amount:40},{id:"2",creator_ref:"a",platform:"instagram",deliverable:"boosting",price_type:"client_price",amount:52},{id:"3",creator_ref:"a",platform:"instagram",deliverable:"usage_right",price_type:"client_price",amount:0},{id:"4",creator_ref:"b",platform:"instagram",deliverable:"boosting",price_type:"creator_cost",amount:10}] as RateLine[];
 const groups=rateServiceRows(lines);assert.equal(groups.length,3);assert.deepEqual(groups[0].ids,["1","2"]);assert.equal(groups[0].client?.amount,52);assert.equal(groups[1].cost,undefined);assert.equal(groups[1].client?.amount,0);assert.equal(groups[2].line.creator_ref,"b");
});
test("25 MB uploads use an owner-specific storage path without traversal",()=>{
 const user="11111111-1111-4111-8111-111111111111";const path=`${user}/1790970000000-22222222-2222-4222-8222-222222222222.xlsx`;
 assert.equal(RATE_UPLOAD_MAX_BYTES,26214400);assert.equal(validRateUploadPath(path,user),true);assert.equal(validRateUploadPath(path,"another-user"),false);assert.equal(validRateUploadPath(user+"/../other.xlsx",user),false);
});
