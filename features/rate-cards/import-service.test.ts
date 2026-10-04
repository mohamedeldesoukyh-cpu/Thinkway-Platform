import {test} from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {parseUpload} from "./import-service";
const a="inf:00000000-0000-4000-8000-000000000001",b="inf:00000000-0000-4000-8000-000000000002";
async function fixture(platform="all", urls=["https://instagram.com/creator/","https://tiktok.com/@creator","https://youtube.com/@creator"]){const book=new ExcelJS.Workbook(),sheet=book.addWorksheet("Rates");sheet.addRow(["Profile URL 1","Profile URL 2","Profile URL 3","Platform","Deliverable Type","Client Selling Price","Client Currency"]);sheet.addRow([...urls,platform,platform==="all"?"reel":"tiktok_video",100,"EGP"]);const form=new FormData();form.set("file",new File([await book.xlsx.writeBuffer() as ArrayBuffer],"rates.xlsx"));return form;}
function database(owners:Record<string,string[]>){return {
 from(table:string){assert.equal(table,"md_currencies");return {select(){return {eq:async()=>({data:[{code:"EGP"}],error:null})};}};},
 async rpc(name:string,args:{p_candidates:{key:string;platform:string}[]}){assert.equal(name,"match_rate_card_handles");return {data:args.p_candidates.flatMap(c=>(owners[c.platform]??[]).map(ref=>({match_key:c.key,creator_ref:ref,creator_name:ref===a?"Existing Creator":"Other Creator"}))),error:null};},
} as unknown as Parameters<typeof parseUpload>[0];}
test("any existing platform anchors a three-link row, regardless of link order",async()=>{
 for(const platform of ["instagram","tiktok","youtube"]){const rows=await parseUpload(database({[platform]:[a]}),await fixture());assert.equal(rows[0].rate?.creator_ref,a);assert.equal(rows[0].rate?.platform,"all");assert.equal(rows[0].profile_urls?.length,3);assert.equal(rows[0].pending_creator,undefined);assert.equal(rows[0].status,"ready");}
});
test("conflicting owners pause the same uploaded file and recheck resolves it",async()=>{
 const form=await fixture();const rows=await parseUpload(database({instagram:[a],tiktok:[b]}),form);assert.equal(rows[0].status,"error");assert.equal(rows[0].conflicts?.length,2);
 const resumed=await parseUpload(database({instagram:[a],tiktok:[a]}),form);assert.equal(resumed[0].status,"ready");assert.equal(resumed[0].rate?.creator_ref,a);
 const duplicate=await parseUpload(database({instagram:[a,b]}),form);assert.equal(duplicate[0].conflicts?.length,2);
});

test("price platform can match the second URL and only one link is required",async()=>{
 const rows=await parseUpload(database({tiktok:[a]}),await fixture("tiktok"));assert.equal(rows[0].status,"ready");assert.equal(rows[0].rate?.platform,"tiktok");assert.equal(rows[0].rate?.creator_ref,a);
 const single=await parseUpload(database({tiktok:[a]}),await fixture("tiktok",["","https://tiktok.com/@creator",""]));assert.equal(single[0].status,"ready");assert.equal(single[0].profile_urls?.length,1);
});
test("link order does not change owner and repeated links are deduplicated",async()=>{
 const rows=await parseUpload(database({instagram:[a]}),await fixture("all",["https://youtube.com/@creator","https://tiktok.com/@creator","https://instagram.com/creator/"]));assert.equal(rows[0].rate?.creator_ref,a);assert.equal(rows[0].profile_urls?.length,3);
 const dup=await parseUpload(database({instagram:[a]}),await fixture("all",["https://instagram.com/creator/","https://instagram.com/creator/?utm_source=x",""]));assert.equal(dup[0].profile_urls?.length,1);
});
