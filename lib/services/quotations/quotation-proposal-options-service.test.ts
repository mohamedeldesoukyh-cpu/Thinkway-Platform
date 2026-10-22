import assert from "node:assert/strict";
import { persistQuotationProposalOptions } from "./quotation-proposal-options-service";

async function run() {
  const options=[{itemIds:["item-a"],recommended:true},{itemIds:["item-a","item-b"],recommended:false}];
  function database(overrides: Record<string,unknown> = {}, conflict=false) {
    const quote={metadata:{templateCreatorPhotos:{a:"photo"},creatorListOrder:["item-b"]},updated_at:"original",status:"draft",is_archived:false,...overrides};
    let patch: any=null;
    const filters: unknown[]=[];
    const client={from(table:string) {
      let updating=false;
      const result=()=>({data:table==="quotation_items"?[{id:"item-a"},{id:"item-b"}]:updating?(conflict?null:{updated_at:patch.updated_at}):quote,error:null});
      const query:any={select(){return query;},eq(key:string,value:unknown){filters.push([key,value]);return query;},update(value:unknown){patch=value;updating=true;return query;},maybeSingle:async()=>result(),then(resolve:any){return Promise.resolve(result()).then(resolve);}};
      return query;
    }};
    return {client:client as any,get patch(){return patch;},filters};
  }
  const db=database();
  assert.equal((await persistQuotationProposalOptions(db.client,"quote",options,"original")).ok,true);
  assert.deepEqual(db.patch.metadata.proposalOptions,options);
  assert.deepEqual(db.patch.metadata.creatorListOrder,["item-b"]);
  assert.deepEqual(db.patch.metadata.templateCreatorPhotos,{a:"photo"});
  assert.ok(db.filters.some(value=>JSON.stringify(value)===JSON.stringify(["updated_at","original"])));
  const clear=database();
  assert.equal((await persistQuotationProposalOptions(clear.client,"quote",[],"original")).ok,true);
  assert.deepEqual(clear.patch.metadata.proposalOptions,[]);
  for(const input of [undefined,{},[{itemIds:[],recommended:true}],[{itemIds:["foreign"],recommended:false}]]) {
    const invalid=database();
    assert.equal((await persistQuotationProposalOptions(invalid.client,"quote",input,"original")).ok,false);
    assert.equal(invalid.patch,null);
  }
  for(const [overrides,revision] of [[{},"stale"],[{status:"approved"},"original"],[{is_archived:true},"original"]] as const) {
    const locked=database(overrides);
    assert.equal((await persistQuotationProposalOptions(locked.client,"quote",options,revision)).ok,false);
    assert.equal(locked.patch,null);
  }
  assert.equal((await persistQuotationProposalOptions(database({},true).client,"quote",options,"original")).ok,false);
  console.log("quotation-proposal-options-service tests passed");
}
void run();
