import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { postingDocumentNumber, postingDocumentDate } from './queue-display';
import { queueCampaignNames } from './queue-campaigns';

test('shortens generated references without changing supplier invoice references',()=>{
  assert.equal(postingDocumentNumber('INV-2026-00001','client_invoice'),'INV-2026-1');
  assert.equal(postingDocumentNumber('CCN-2026-00120','client_credit_note'),'CCN-2026-120');
  assert.equal(postingDocumentNumber('INV-2026-00001','supplier_invoice'),'INV-2026-00001');
  assert.equal(postingDocumentNumber('External-00015','internal_cost'),'External-00015');
  assert.equal(postingDocumentDate('2026-06-19'),'19 Jun 2026');
});

test('campaign names follow each document, cost assignment and related client invoice',async()=>{
  const calls:string[]=[];
  const tables:Record<string,Record<string,string|null>[]>={
    invoices:[{id:'invoice',campaign_header_id:'campaign'}],
    client_credit_notes:[{id:'credit',campaign_header_id:null}],
    client_debit_notes:[{id:'debit',campaign_header_id:'campaign'}],
    vendor_credit_notes:[{id:'vendor-credit',campaign_header_id:'campaign'}],
    vendor_debit_notes:[{id:'vendor-debit',campaign_header_id:'campaign'}],
    campaign_lines:[{id:'line',campaign_header_id:'campaign'}],
    campaign_headers:[{id:'campaign',name:'Summer campaign'}],
  };
  const db={from:(table:string)=>({select:()=>({in:(_key:string,ids:string[])=>{
    calls.push(table);return Promise.resolve({data:(tables[table]??[]).filter(row=>ids.includes(row.id!)),error:null});
  }})})} as unknown as SupabaseClient;
  const rows=[{id:'invoice',type:'client_invoice'},{id:'credit',type:'client_credit_note',invoice:'invoice'},
    {id:'debit',type:'client_debit_note'},{id:'vendor-credit',type:'vendor_credit_note'},
    {id:'vendor-debit',type:'vendor_debit_note'},{id:'cost',type:'internal_cost',assignment:'line'},
    {id:'supplier',type:'supplier_invoice',assignment:'line'}, {id:'unlinked',type:'internal_cost'}];
  const result=await queueCampaignNames(db,rows);
  assert.ok(result.slice(0,7).every(row=>row.campaign==='Summer campaign'));
  assert.equal(result[7].campaign,null);
  assert.equal(calls.filter(table=>table==='campaign_lines').length,1);
  assert.equal(calls.filter(table=>table==='campaign_headers').length,1);
  assert.equal('campaign' in rows[0],false);
});

test('unavailable campaign rows stay unnamed and query errors are reported',async()=>{
  const empty={from:()=>({select:()=>({in:async()=>({data:[],error:null})})})} as unknown as SupabaseClient;
  assert.equal((await queueCampaignNames(empty,[{id:'hidden',type:'client_invoice'}]))[0].campaign,null);
  const failed={from:()=>({select:()=>({in:async()=>({data:null,error:{message:'denied'}})})})} as unknown as SupabaseClient;
  await assert.rejects(queueCampaignNames(failed,[{id:'hidden',type:'client_invoice'}]),/Could not load document campaigns/);
});
