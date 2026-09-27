import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editVersionMetadata,versionControls} from './version-controls';
import {isVersionReleasedToClient} from './client-release';
const released={released_to_client_at:'2026-09-27T10:00:00Z',attribution:'preserved'};
test('hide, remove and restore preserve metadata but block client visibility',()=>{
  assert.equal(isVersionReleasedToClient(released),true);
  for (const visibility of ['hide','remove','restore'] as const) {
    const next=editVersionMetadata(released,{visibility},'actor','now');
    assert.equal(isVersionReleasedToClient(next),false);
    assert.equal(next.attribution,'preserved');
    const shown=editVersionMetadata(next,{visibility:'show'},'actor','later');
    assert.equal(isVersionReleasedToClient(shown),true);
    assert.equal(versionControls(shown).removed,false);
  }
});
test('internal approval is independent of client decisions and visibility',()=>{
  const next=editVersionMetadata(released,{status:'internally_approved'},'actor','now');
  assert.equal(versionControls(next).status,'internally_approved');
  assert.equal(isVersionReleasedToClient(next),true);
  assert.equal('decision' in next,false);
});
test('invalid status, name and visibility fail closed',()=>{
  assert.throws(()=>editVersionMetadata(released,{status:'approved' as never},'actor','now'));
  assert.throws(()=>editVersionMetadata(released,{name:' '},'actor','now'));
  assert.throws(()=>editVersionMetadata(released,{visibility:'delete_forever' as never},'actor','now'));
});
