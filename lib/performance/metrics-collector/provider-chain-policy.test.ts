import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldStopProviderChain } from './provider-chain-policy';
import { tryTikTokApiProvider } from './providers/tiktok-api';
import { providerChainForPlatform } from './detect-platform';
import { isCompleteMetrics } from './merge-metrics';

test('TikTok refresh reaches Apify even when stored metrics already exist', async () => {
 assert.equal(isCompleteMetrics({views:2576,likes:52,comments:3}), true);
 const visited:string[]=[];
 for (const provider of providerChainForPlatform('tiktok')) {
  visited.push(provider);
  const attempt = provider === 'tiktok_api'
   ? await tryTikTokApiProvider({contentUrl:'https://www.tiktok.com/@creator/video/123',mediaId:'123',env:{tiktokClientKey:null,tiktokClientSecret:null}})
   : {provider, available:true, metrics:{views:3000}};
  if (shouldStopProviderChain(attempt)) break;
 }
 assert.deepEqual(visited,['tiktok_api','apify']);
});
test('errors and empty results continue; fresh zero and Apify partial results finish', () => {
 assert.equal(shouldStopProviderChain({provider:'tiktok_api',available:true,error:'Not licensed'}),false);
 assert.equal(shouldStopProviderChain({provider:'apify',available:true,metrics:{}}),false);
 assert.equal(shouldStopProviderChain({provider:'apify',available:true,metrics:{views:0}}),true);
 assert.equal(shouldStopProviderChain({provider:'apify',available:true,metrics:{shares:5}}),true);
});
