import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { saveShortlistTemplatePhoto } from "./template-photo-service";
const row = {metadata:{creatorListOrder:["a","b"],recommendedCreatorIds:["b"],other:true},updated_at:"2026-10-19T00:00:00Z",status:"draft" as const};
function fixture(item: unknown = {id:"a"}, saved: unknown = {id:"sl"}) {
 const writes: Record<string,unknown>[]=[];const filters: [string,unknown][]=[];
 const db={from(table:string){let patch=false;const q={select:()=>q,eq:(key:string,value:unknown)=>{filters.push([key,value]);return q;},update:(value:Record<string,unknown>)=>{patch=true;writes.push(value);return q;},maybeSingle:async()=>({data:patch?saved:item,error:null})};return q;}};
 return {db:db as never,writes,filters};
}
async function upload(){const bytes=await sharp({create:{width:40,height:60,channels:3,background:"#0057ff"}}).png().toBuffer();const form=new FormData();form.set("file",new File([new Uint8Array(bytes)],"test.png",{type:"image/png"}));return form;}
test("shortlist photo saves preserve order and stars and enforce membership/concurrency",async()=>{
 const f=fixture();const result=await saveShortlistTemplatePhoto(f.db,"sl","a",await upload(),row);assert.equal(result.ok,true);
 if(!result.ok)return;assert.ok(result.photo?.startsWith("data:image/webp;base64,"));
 assert.deepEqual(f.writes[0].metadata,{...row.metadata,templateCreatorPhotos:{a:result.photo}});
 assert.ok(f.filters.some(([key,value])=>key==="shortlist_id"&&value==="sl"));
 assert.ok(f.filters.some(([key,value])=>key==="updated_at"&&value===row.updated_at));
 const missing=fixture(null);assert.equal((await saveShortlistTemplatePhoto(missing.db,"sl","a",await upload(),row)).ok,false);assert.equal(missing.writes.length,0);
 const stale=fixture({id:"a"},null);assert.equal((await saveShortlistTemplatePhoto(stale.db,"sl","a",await upload(),row)).ok,false);
 const reset=new FormData();reset.set("reset","true");const r=fixture();
 assert.equal((await saveShortlistTemplatePhoto(r.db,"sl","a",reset,{...row,metadata:{...row.metadata,templateCreatorPhotos:{a:result.photo,b:result.photo}}})).ok,true);
 assert.deepEqual(r.writes[0].metadata,{...row.metadata,templateCreatorPhotos:{b:result.photo}});
});
test("invalid uploaded bytes never reach the database update",async()=>{
 const f=fixture();const form=new FormData();form.set("file",new File(["not a photo"],"test.png",{type:"image/png"}));assert.equal((await saveShortlistTemplatePhoto(f.db,"sl","a",form,row)).ok,false);assert.equal(f.writes.length,0);
});
