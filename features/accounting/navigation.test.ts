import assert from 'node:assert/strict';
import {test} from 'node:test';
import {accountingGroups,accountingNavigation,visibleAccountingNavigation} from './navigation';

test('all legacy screens remain reachable; vendor preset reuses the shared directory',()=>{
  const items=visibleAccountingNavigation({accounting:true,admin:true});
  assert.deepEqual(new Set(items.map(item=>item.view)),new Set(['pl-closing','customer-advances','vendor-advances','balance-sheet','cash-flow','vendor-aging','auxiliary-statements','client-statements','vendor-statements','unsettled-receivables','unsettled-payables','closing','audit-viewer','budget-setup','budget-control','budget-reports','financial-statements','aging','payment-preparation','cheques','banks','reconciliation','bank-movements','recurring','scheduled-reversal','opening','transfers','approvals','transaction-locks','approval-policy','parties','vendors','mapping','auxiliaries','moves','expenses','statements','costs','payments','receipts','invoices','chart','company','years','users','journals','ledger','trial','periods']));
  assert.ok(items.every(item=>item.route==='/accounting'));
});
test('registry has unique identities, valid parents, bilingual labels and evidence',()=>{
  assert.equal(accountingGroups.length,10);
  assert.equal(new Set(accountingNavigation.map(item=>item.id)).size,accountingNavigation.length);
  for(const item of accountingNavigation){
    assert.ok(accountingGroups.some(group=>group.id===item.parent));
    assert.ok(item.en && /[\u0600-\u06ff]/.test(item.ar) && item.evidence);
  }
  assert.equal(accountingNavigation.some(item=>/cost.?cent(er|re)/i.test(item.en)),false);
});
test('pending and embedded/global capabilities never become placeholder links',()=>{
  const visible=visibleAccountingNavigation({accounting:true,admin:true});
  assert.ok(visible.every(item=>item.status==='Ready'&&item.view&&item.route&&item.navigation));
  for(const item of accountingNavigation.filter(item=>item.status==='Pending'))assert.equal(visible.includes(item),false);
  assert.equal(visible.some(item=>item.id==='global-administration'||item.id==='exchange-rates'),false);
});
test('navigation preserves accounting and administrator visibility boundaries',()=>{
  assert.deepEqual(visibleAccountingNavigation({accounting:false,admin:true}),[]);
  assert.equal(visibleAccountingNavigation({accounting:true,admin:false}).some(item=>item.view==='users'||item.view==='approval-policy'),false);
  assert.equal(visibleAccountingNavigation({accounting:true,admin:true}).filter(item=>item.view==='users').length,1);
});
test('transaction controls, workflows and fiscal closing are ready',()=>{
  for(const id of ['moves','periods','approvals','transaction-locks','transfers','opening','recurring','scheduled-reversal'])assert.equal(accountingNavigation.find(item=>item.id===id)?.status,'Ready');
  for(const id of ['closing','audit-viewer'])assert.equal(accountingNavigation.find(item=>item.id===id)?.status,'Ready');
});
