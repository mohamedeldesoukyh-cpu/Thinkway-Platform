import "./approved-quotation-immutability.env";
import assert from "node:assert/strict";
import { test } from "node:test";
import { quotationCopyHeader, quotationCopyItems, duplicateQuotationDocument } from "./quotation-duplicate-service";

test("copy starts an independent draft while retaining commercial content and presentation order", () => {
  const source = { name: "Option A", status: "approved", serial_number: "QT-26-1", campaign_header_id: "camp",
    approved_by: "approver", client_signed_at: "yesterday", shared_with_client: true, parent_quotation_id: "parent",
    client_id: "client", currency: "USD", terms: "Terms", metadata: { creatorListOrder: ["old"], showOriginalCurrency: true, approval: "approved" } };
  const copy = quotationCopyHeader(source, new Map([["old", "new"]])) as Record<string, any>;
  assert.equal(copy.name, "Option A (Copy)"); assert.equal(copy.status, "draft");
  assert.equal(copy.campaign_header_id, null); assert.equal(copy.client_id, "client");
  assert.equal(copy.currency, "USD"); assert.equal(copy.terms, "Terms");
  for (const key of ["serial_number", "approved_by", "client_signed_at", "parent_quotation_id"]) assert.equal(copy[key], undefined);
  assert.equal(copy.shared_with_client, false); assert.deepEqual(copy.metadata.creatorListOrder, ["new"]);
  assert.equal(copy.metadata.approval, undefined); assert.equal(source.status, "approved");
});

test("copies all option prices and fees with new item/package identities", () => {
  const rows = [1, 2].map(n => ({ id: `old${n}`, quotation_id: "source", collapse_group_id: "group", source_shortlist_item_id: "sl",
    option_number: 2, cost: 100, revenue: 150, af_pct: 10, af_value: 15, cost_fx_override: "custom", deliverables: [{ quantity: 2 }] }));
  const copied = quotationCopyItems(rows, "copy", new Map([["old1", "new1"], ["old2", "new2"]]));
  assert.equal(copied[0].id, "new1"); assert.equal(copied[1].id, "new2");
  assert.equal(copied[0].quotation_id, "copy"); assert.equal(copied[0].source_shortlist_item_id, null);
  assert.notEqual(copied[0].collapse_group_id, "group"); assert.equal(copied[0].collapse_group_id, copied[1].collapse_group_id);
  for (const key of ["cost", "revenue", "af_pct", "af_value", "cost_fx_override", "deliverables", "option_number"]) assert.deepEqual(copied[0][key as keyof typeof copied[0]], rows[0][key as keyof typeof rows[0]]);
});

function mockCopyClient(failItems = false, failRead = false) {
  const writes: {table:string; op:string; value:any}[] = [];
  let itemPages = 0;
  const client = { from(table:string) {
    let op = "read"; let value:any; let offset = 0; let id:string;
    const q:any = {};
    for (const method of ["select", "order"]) q[method] = () => q;
    q.eq = (_key:string,v:string) => { id=v; return q; };
    q.range = (start:number) => { offset=start; return q; };
    for (const method of ["insert", "delete"]) q[method] = (v:any) => { op=method; value=v; writes.push({table,op,value:v}); return q; };
    const result = () => {
      if (op === "delete") { writes[writes.length-1].value=id; return {data:null,error:null}; }
      if (op === "insert") return table === "quotations" ? {data:{id:"copy"},error:null} : {data:null,error:failItems ? {message:"insert failed"}:null};
      if (table === "quotations") return {data:{id:"source",name:"Example",status:"draft"},error:null};
      itemPages++;
      return {data:failRead ? null : Array.from({length:offset === 0 ? 1000 : 1},(_,i)=>({id:`line${offset+i}`,cost_egp:10,revenue_egp:20,af_value_egp:2})),error:failRead?{message:"read failed"}:null};
    };
    q.single = async()=>result(); q.then = (resolve:any)=>Promise.resolve(result()).then(resolve);
    return q;
  }};
  return {client:client as never,writes,pages:()=>itemPages};
}

test("full copy paginates beyond 1000 items and computes fees-inclusive source amounts", async()=>{
  const m=mockCopyClient(); const result=await duplicateQuotationDocument(m.client,"user","source");
  assert.equal(result.ok,true); assert.equal(m.pages(),2);
  assert.equal(m.writes.find(w=>w.table==="quotation_items")?.value.length,1001);
  const header=m.writes.find(w=>w.table==="quotations")!.value;
  assert.equal(header.total_revenue_egp,20020); assert.equal(header.total_af_egp,2002);
});
test("failed item copy removes only the new draft and reports failure",async()=>{
  const m=mockCopyClient(true); const result=await duplicateQuotationDocument(m.client,"user","source");
  assert.equal(result.ok,false); assert.equal(m.writes.find(w=>w.op==="delete")?.value,"copy");
});
test("failed source read creates nothing",async()=>{
  const m=mockCopyClient(false,true); const result=await duplicateQuotationDocument(m.client,"user","source");
  assert.equal(result.ok,false); assert.equal(m.writes.length,0);
});
