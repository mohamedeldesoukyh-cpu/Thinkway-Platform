import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialPresentation } from './components/commercial-investment';
import type { ClientWorkspaceView } from './types';

function fixture(): ClientWorkspaceView {
  return { creators: [], commercial: {currency:'EGP',lines:[{label:'Nour نور',amount:35000},{label:'Ahmed أحمد',amount:59900}],selectedCount:0,totalInvestment:0},
    quotation:{serialNumber:'TEST',lines:[{creatorId:'a',label:'Nour نور',amount:35000},{creatorId:'b',label:'Ahmed أحمد',amount:59900}]},
  } as unknown as ClientWorkspaceView;
}
test('priced quotation stays coherent with an empty approved-selection snapshot', () => {
  const model = commercialPresentation(fixture());
  assert.equal(model.count,2);
  assert.equal(model.subtotal,94900);
  assert.equal(model.fees,null);
  assert.equal(model.total,null);
  assert.equal(model.approved,false);
  assert.ok(model.rows.every(row=>row.status==='Pending your approval'));
});
test('legacy commercial lines remain visible without inventing confirmed fees', () => {
  const view=fixture(); view.quotation=undefined;
  view.commercial.lines=[{label:'A',amount:100},{label:'B'}];
  const model=commercialPresentation(view);
  assert.equal(model.count,2);assert.equal(model.subtotal,100);
  assert.equal(model.rows[1].amount,undefined);assert.equal(model.total,null);
});
test('quotation discovery pool cannot inflate the current commercial proposal', () => {
  const view=fixture();
  view.quotation!.lines.push({creatorId:'other',label:'Not in current proposal',amount:999999});
  assert.equal(commercialPresentation(view).subtotal,94900);
  assert.equal(commercialPresentation(view).count,2);
  view.commercial.lines=[];
  assert.equal(commercialPresentation(view).count,0);
});
test('hidden cost and fees uses the client-facing combined amount', () => {
  const view=fixture();view.hideCostAndFees=true;
  view.creators=[{creatorId:'a',displayName:'Nour',investmentAmount:35000,agencyFeeAmount:5000}] as ClientWorkspaceView['creators'];
  const model=commercialPresentation(view);
  assert.equal(model.rows[0].amount,40000);assert.equal(model.subtotal,99900);
});
