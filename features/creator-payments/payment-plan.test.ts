import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankDetails, calculatePayment, paymentStatus, type PaymentRow } from './model';
import { changedPaymentPlans, defaultPaymentDraft, paymentDraftSchema } from './payment-plan';
const row: PaymentRow = { assignmentId:'a', campaignId:'c', creatorId:'i', creator:'Example', ioId:'io', ioNumber:'IO', ioStatus:'approved', currency:'USD', fee:5000, vat:0, paid:0, reserved:0, bank:bankDetails() };
test('new payment entries start empty even when an old preparation plan exists', () => {
    const draft = { ...defaultPaymentDraft(row), mode:'percent', percent:50 };
    assert.equal(changedPaymentPlans([row],{a:draft}).length,1);
    assert.equal(calculatePayment(row,draft).remaining,2500);
    assert.equal(calculatePayment(row,draft).outstanding,5000);
    const saved = { ...row, savedDraft:draft };
    assert.equal(defaultPaymentDraft(saved).amount,0);
    assert.equal(defaultPaymentDraft(saved).mode,'manual');
    assert.equal(changedPaymentPlans([saved],{a:draft}).length,1);
    assert.equal(paymentStatus(saved.paid,5000).label,'Unpaid');
    assert.equal(changedPaymentPlans([saved],{a:{...draft,percent:25}}).length,1);
    assert.equal(changedPaymentPlans([saved],{}).length,0);
});
test('remaining deducts both pending exports and this payment in original currency with VAT', () => {
    const r = { ...row, vat:10, paid:500, reserved:1000 };
    const d = { ...defaultPaymentDraft(r), mode:'manual', currency:'EGP', rate:50, amount:100000 };
    const c = calculatePayment(r,d);
    assert.equal(c.total,5500);
    assert.equal(c.outstanding,5000);
    assert.equal(c.remaining,2000);
    assert.equal(c.remaining*c.rate,100000);
    assert.deepEqual(c.errors,[]);
});
test('invalid percentages fail save and persisted plans cannot replace agreed fees', () => {
    assert.equal(paymentDraftSchema.safeParse({...defaultPaymentDraft(row),percent:150}).success,false);
    assert.equal(defaultPaymentDraft({...row,savedDraft:{...defaultPaymentDraft(row),fee:1}}).fee,5000);
});
