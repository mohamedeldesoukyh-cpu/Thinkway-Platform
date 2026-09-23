import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorAssignmentCommercials, creatorFinancialDisplay } from './financial-display';
import type { VendorAssignmentRow, VendorPayoutRow } from './types';
function assignment(line: Parameters<typeof creatorAssignmentCommercials>[0], currency='AED') {
 return {id:'a',status:'confirmed',campaign_status:'active',currency,billing_status:'draft',...creatorAssignmentCommercials(line,1000,currency)} as VendorAssignmentRow;
}
test('creator fees are cost, never a fallback for missing client revenue',()=>{
 const row=assignment(null);
 assert.equal(row.revenue,0); assert.equal(row.cost,1000);
 const display=creatorFinancialDisplay([row],[]);
 assert.match(display.revenue,/AED/); assert.match(display.cost,/AED/); assert.doesNotMatch(display.cost,/EGP/);
});
test('client revenue includes usage rights and agency fee, excluding VAT',()=>{
 const row=assignment({currency_code:'USD',revenue_before_vat:2000,cost_before_vat:1000,usage_rights_amount:100,usage_rights_cost:50,agency_fee_percent:10});
 assert.equal(row.revenue,2310);assert.equal(row.gp,1260);
});
test('native creator costs, client revenue and payouts retain independent currencies',()=>{
 const row=assignment({currency_code:'USD',revenue_before_vat:2000,cost_before_vat:1000,cost_received:3670,cost_received_currency:'AED'});
 const display=creatorFinancialDisplay([row],[{amount:3670,paid_amount:670,currency:'AED',status:'partial'} as VendorPayoutRow]);
 assert.match(display.revenue,/USD/);assert.match(display.cost,/AED/);assert.match(display.pending,/AED/);assert.match(display.gp,/USD/);
 assert.equal(row.cost,3670);assert.equal(row.gp,1000);
});
test('mixed currencies stay separate and cancelled assignments do not inflate totals',()=>{
 const a=assignment({currency_code:'USD',revenue_before_vat:2000,cost_before_vat:1000});
 const b=assignment({currency_code:'AED',revenue_before_vat:5000,cost_before_vat:3000});
 const cancelled={...b,revenue:999999,status:'cancelled'};
 const display=creatorFinancialDisplay([a,b,cancelled],[]);
 assert.match(display.revenue,/AED.*·.*USD/); assert.doesNotMatch(display.revenue,/999/);
 assert.match(display.margin,/USD/);assert.match(display.margin,/AED/);
});
