import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mappedAuxiliaries} from './mapping-model';
import type {AccountingSetup} from './setup-types';
test('a new cost invoice selects the Cost auxiliary, not the UR Cost mapping on the same GL',()=>{
 const setup={mappings:[{key:'assignment_cost',account:'511001',auxiliary_id:'cost'},{key:'usage_rights_cost',account:'511001',auxiliary_id:'usage-rights'}]} as AccountingSetup;
 assert.deepEqual(mappedAuxiliaries(setup,['assignment_cost','input_vat']),{'511001':'cost'});
});
