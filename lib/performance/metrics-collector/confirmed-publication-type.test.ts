import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmedPublicationType } from './confirmed-publication-type';
test('explicit reel evidence overrides ambiguous post URLs', () => {
  assert.equal(confirmedPublicationType('instagram',{url:'https://instagram.com/p/example/',productType:'clips'}),'instagram_reel');
  assert.equal(confirmedPublicationType('instagram',{product_type:'reels'}),'instagram_reel');
  for (const row of [{type:'Video'}, {productType:'feed',isVideo:true}, {productType:'igtv'}, {productType:'clips',error:'unavailable'}]) assert.equal(confirmedPublicationType('instagram',row),null);
  assert.equal(confirmedPublicationType('facebook',{productType:'clips'}),null);
});
