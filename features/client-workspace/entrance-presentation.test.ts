import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entranceState, distinctNextStep } from './entrance-presentation';
const base = { shortlistStage: 'sent', quotationStage: 'none' };
test('entrance follows journey permissions and stages, not generic approved status', () => {
    assert.equal(entranceState(base, 'approved'), 'awaiting');
    assert.equal(entranceState({ ...base, quotationStage: 'approved', selectedCount: 0 }, 'approved'), 'awaiting');
    assert.equal(entranceState({ ...base, quotationStage: 'approved' }, 'approved'), 'approved_setup');
    assert.equal(entranceState({ ...base, canConfirmCreators: true }, 'awaiting_review'), 'creators');
    assert.equal(entranceState({ ...base, canApproveFinalQuotation: true }, 'awaiting_review'), 'quotation');
    assert.equal(entranceState({ ...base, shortlistStage: 'approved' }, 'approved'), 'shortlistok');
    assert.equal(entranceState({ ...base, quotationStage: 'changes_requested' }, 'changes_requested'), 'changes');
    assert.equal(entranceState({ ...base, quotationStage: 'rejected' }, 'rejected'), 'rejected');
    assert.equal(entranceState({ ...base, historical: true, quotationStage: 'approved' }, 'approved'), 'awaiting');
});
test('identical status and next step are only displayed once', () => {
    assert.equal(distinctNextStep('Setting up', ' setting UP '), false);
    assert.equal(distinctNextStep('Approved', 'Quotation follows'), true);
    assert.equal(distinctNextStep('Approved', ' '), false);
});
