import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecoveryList } from '../src/recovery-list.ts';

const row={id:'00000000-0000-4000-8000-000000000001',checkin_id:'00000000-0000-4000-8000-000000000002',base_version:0,text:''};
test('recovery lists reject malformed, duplicated and unsafe records', () => {
  assert.deepEqual(parseRecoveryList([row]),[row]);
  for (const value of [null,{},[null],[row,row],[{...row,id:'bad'}],[{...row,text:null}],
    [{...row,text:'x'.repeat(10001)}],[{...row,base_version:-1}]]) {
    assert.throws(()=>parseRecoveryList(value),/Recovery list unavailable/);
  }
});
