import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCommercialIoSnapshot } from "./load-commercial-io";

test("initial workspace IO snapshot contains the ready card data but no document or approval secrets", async () => {
  const io = {id:"io-1",document_number:"CIO-1",status:"approved",approved_at:"2026-09-28T12:00:00Z",terms_html:"<body>private saved terms</body>",approval_token_hash:"secret-hash"};
  const scopes: unknown[] = [];
  const db = {from: () => {
    const q: any = {select:()=>q,eq:(key:string,value:unknown)=>{scopes.push([key,value]);return q;},order:()=>q,limit:()=>q,maybeSingle:async()=>({data:io})};return q;
  }};
  const snapshot = await loadCommercialIoSnapshot(db as never,"campaign-1");
  assert.deepEqual(snapshot.io,{id:"io-1",number:"CIO-1",status:"approved",approved:true,canApprove:false,available:true});
  assert.doesNotMatch(JSON.stringify(snapshot),/private saved terms|secret-hash|approval_token/);
  assert.deepEqual(scopes,[["campaign_header_id","campaign-1"],["is_superseded",false]]);
  assert.equal((await loadCommercialIoSnapshot(db as never,null)).io,null);
});
