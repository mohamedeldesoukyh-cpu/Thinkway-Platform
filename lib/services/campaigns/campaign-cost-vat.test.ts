import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveLineVatInput } from './campaign-commercial';
const input = { revenue:2000,cost:1000,revenue_vat_percent:14,cost_vat_percent:14,cost_vat_exempt:false };
const defaults = { clientVatRate:14,vendorVatRate:5,vendorVatRegistered:false };
test('explicit assignment cost VAT overrides the CRM registration default',()=>{
 const result=resolveLineVatInput(input,defaults);
 assert.equal(result.cost_before_vat,1000);
 assert.equal(result.cost_vat_percent,14);
 assert.equal(result.cost_vat_amount,140);
 assert.equal(result.cost_after_vat,1140);
 assert.equal(result.revenue_vat_amount,280);
});
test('cost exemption and explicit zero are respected without changing revenue VAT',()=>{
 for(const change of [{cost_vat_exempt:true},{cost_vat_percent:0}]){
 const result=resolveLineVatInput({...input,...change},{...defaults,vendorVatRegistered:true});
 assert.equal(result.cost_vat_amount,0);
 assert.equal(result.cost_after_vat,1000);
 assert.equal(result.revenue_vat_amount,280);
 }
});
