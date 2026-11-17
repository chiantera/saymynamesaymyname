import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudFailure } from '../src/request-errors.ts';

test('only the exact server conflict from a decision becomes a safe conflict', () => {
  assert.equal(cloudFailure({code:'P0001',message:'stale_decision'},'decision').status,409);
  for (const [value,operation] of [
    [{code:'P0001',message:'stale_decision'},'other'],
    [{code:'P0001',message:'stale_decision private content'},'decision'],
    [{code:'other',message:'stale_decision'},'decision'],
    [{code:'P0001',message:'stale_membership'},'decision'],
    [null,'decision'],
  ] as const) {
    const error=cloudFailure(value,operation);
    assert.equal(error.status,0);
    assert.equal(error.message,'Request failed');
  }
});
