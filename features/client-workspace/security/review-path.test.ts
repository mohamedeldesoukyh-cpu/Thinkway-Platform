import assert from 'node:assert/strict';
import test from 'node:test';
import { buildClientReviewPath } from './review-path';
import { buildClientReviewPath as legacyPath, hashClientReviewToken } from './review-token';
test('browser-safe review paths preserve existing encoding and destinations',()=>{
for(const section of [undefined,'creators','feedback']){
const expected='/review/review-id'+(section?'/'+section:'')+'?sign=token%2B%26%3D';
assert.equal(buildClientReviewPath('review-id','token+&=',section),expected);
assert.equal(legacyPath('review-id','token+&=',section),expected);
}
assert.equal(hashClientReviewToken('synthetic-token'),hashClientReviewToken(' synthetic-token '));
});
