import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadCreatorListClientIdentity} from './creator-list-client-logo';
function db(client:unknown,group:unknown,fail=false){return {from(table:string){return {select(){return this},eq(){return this},async maybeSingle(){return {data:table==='clients'?client:group,error:fail?new Error('Lookup failed'):null}}}}} as any;}
test('group name wins even without a logo, with no mismatched client artwork',async()=>{
 assert.deepEqual(await loadCreatorListClientIdentity(db({name:'Client',logo_url:'https://unused-client-logo',group_id:'g'},{name:'Group',logo_url:null}),'c'),{name:'Group',logo:null});
});
test('no group falls back to client name; missing client is safe',async()=>{
 assert.deepEqual(await loadCreatorListClientIdentity(db({name:'Client',logo_url:null,group_id:null},null),'c'),{name:'Client',logo:null});
 assert.equal(await loadCreatorListClientIdentity(db(null,null),'c'),null);
});
test('lookup failures never silently publish the wrong identity',async()=>{
 await assert.rejects(loadCreatorListClientIdentity(db(null,null,true),'c'),/Could not load/);
});
