import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementCampaignLabels } from './campaign-label';
const history=[{id:'first',created_at:'2026-01-01',status:'sent'},{id:'second',created_at:'2026-02-01',status:'sent'}];
const invoices=history.map(h=>({id:h.id,campaign_name:'Campaign Name'}));
const lines=history.map(h=>({invoice_id:h.id,campaign_line_id:'creator-assignment',revenue_before_vat:100,description:'Creator Name — 50% of original billable amount'}));
test('campaign labels include saved percentage and ordinal, without creator names',()=>{
 const labels=statementCampaignLabels(invoices,history,lines);
 assert.equal(labels.get('first'),'50% of “Campaign Name”');
 assert.equal(labels.get('second'),'2nd 50% of “Campaign Name”');
 assert.ok(![...labels.values()].some(label=>label.includes('Creator Name')));
});
test('multiple deliverables in one invoice count as one installment; void invoices do not count',()=>{
 const labels=statementCampaignLabels(invoices,[{...history[0],status:'void'},history[1]],[...lines,lines[1]]);
 assert.equal(labels.get('second'),'50% of “Campaign Name”');
});
test('missing or mixed percentages retain campaign without inventing a rate',()=>{
 assert.equal(statementCampaignLabels(invoices,history,[{...lines[0],description:'Creator Name'}]).get('first'),'Campaign Name');
 assert.equal(statementCampaignLabels(invoices,history,[lines[0],{...lines[0],description:'25% of original billable amount'}]).get('first'),'Campaign Name');
});
