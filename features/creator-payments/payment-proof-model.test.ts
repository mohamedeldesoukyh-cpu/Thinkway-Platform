import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validatePaymentProof, PAYMENT_PROOF_MAX_BYTES } from './payment-proof-model';
test('accepts PDF and supported images only', () => {
 for(const type of ['application/pdf','image/jpeg','image/png','image/webp']) assert.equal(validatePaymentProof({name:'proof',type,size:120}),null);
 for(const type of ['text/html','image/svg+xml','application/javascript','']) assert.ok(validatePaymentProof({name:'proof',type,size:120}));
});
test('enforces upload size and filename bounds', () => {
 for(const size of [0,-1,PAYMENT_PROOF_MAX_BYTES+1]) assert.ok(validatePaymentProof({name:'proof.pdf',type:'application/pdf',size}));
 assert.equal(validatePaymentProof({name:'proof.pdf',type:'application/pdf',size:PAYMENT_PROOF_MAX_BYTES}),null);
 assert.ok(validatePaymentProof({name:' '.repeat(5),type:'application/pdf',size:1}));
 assert.ok(validatePaymentProof({name:'x'.repeat(181),type:'application/pdf',size:1}));
});
