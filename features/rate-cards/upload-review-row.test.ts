import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {UploadReviewRow} from './upload-review-row';
import type {ImportRow,RateInput} from './model';
const main:RateInput={creator_ref:'inf:123',creator_name:'Test Creator',platform:'instagram',deliverable:'instagram_reel',amount:0,currency:'EGP',notes:'',price_type:'creator_cost',agency_fee_percent:0};
test('compact rows keep ten aligned cells, zero prices, platform marks and expandable extras',()=>{
 const row:ImportRow={row:2,status:'ready',issues:[],rate:main,rates:[main,{...main,price_type:'client_price',amount:100},{...main,deliverable:'boosting',period_months:2,amount:900}]};
 const html=renderToStaticMarkup(createElement(UploadReviewRow,{row,lang:'en'}));
 assert.equal((html.match(/<td/g)??[]).length,10);
 assert.match(html,/>0<\/b>/);assert.match(html,/>IG<\/span>/);assert.match(html,/>TC<\/span>/);
 assert.match(html,/aria-expanded="false"/);assert.match(html,/Pricing details/);assert.doesNotMatch(html,/>900<\/b>/);
});
test('missing prices remain distinct from zero and diagnostics retain source cells',()=>{
 const row:ImportRow={row:4,status:'error',issues:['invalid'],diagnostics:[{cell:'E4',column:'Creator Cost',value:'-1',message:'Enter zero or a positive number.',message_ar:'أدخل صفراً أو رقماً موجباً.'}]};
 const html=renderToStaticMarkup(createElement(UploadReviewRow,{row,lang:'en'}));
 assert.match(html,/Not priced/);assert.match(html,/E4/);assert.match(html,/Enter zero or a positive number/);
});
