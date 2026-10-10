import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadLegalEntityIdsForReview } from './identity-logo';

test('identity reads overlap without changing client, brand, or header precedence', async () => {
  const started: string[] = [];
  const release: Array<() => void> = [];
  const db = { from(table: string) {
    let column = '', value = '';
    const query = {
      select() { return query; }, eq(c: string, v: string) { column=c; value=v; return query; },
      limit() { return query; }, maybeSingle() { return query; },
      then(resolve: (result: unknown) => void) {
        started.push(`${table}:${value}`);
        const data = table==='quotations' ? {client_id:'quote-client',brand_id:'quote-brand',campaign_header_id:'quote-header'}
          : table==='discovery_shortlists' ? {client_id:'short-client',brand_id:'short-brand',campaign_header_id:'short-header'}
          : table==='campaign_headers' ? {client_id:'header-client',brand_id:'header-brand'}
          : column==='id' ? {client_id:'brand-client'}
          : [{client_id:value==='brand'?'named-brand-client':'named-campaign-client'},{client_id:'quote-client'}];
        const finish=()=>resolve({data,error:null});
        if(table==='quotations'||table==='discovery_shortlists'||column==='name_normalized') release.push(finish);
        else finish();
      },
    }; return query;
  }};
  const result=loadLegalEntityIdsForReview(db as never,{quotationId:'q',shortlistId:'s',brandName:'Brand',campaignName:'Campaign',campaignHeaderId:'explicit-header'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(started.length,4,'all four independent reads must start before any finishes');
  release.reverse().forEach(finish=>finish());
  assert.deepEqual(await result,['quote-client','short-client','header-client','brand-client','named-brand-client','named-campaign-client']);
  assert.ok(started.includes('campaign_headers:explicit-header'));
  assert.ok(started.includes('brands:quote-brand'));
  assert.equal(started.length,6);
});

test('denied or missing identity rows never manufacture a client entitlement',async()=>{
  const db={from(){const query={select(){return query},eq(){return query},limit(){return query},maybeSingle(){return query},then(resolve:(result:unknown)=>void){resolve({data:null,error:{message:'denied'}})}};return query}};
  assert.deepEqual(await loadLegalEntityIdsForReview(db as never,{quotationId:'q',shortlistId:'s',brandName:'Brand'}),[]);
});
