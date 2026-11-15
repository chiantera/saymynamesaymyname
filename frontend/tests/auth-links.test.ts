import test from 'node:test';
import assert from 'node:assert/strict';
import {authRedirect, readAuthCallback} from '../src/auth-links.ts';

test('auth redirects stay on the app origin with fixed routes', () => {
  assert.equal(authRedirect('https://example.test/'), 'https://example.test/auth/callback');
  assert.equal(authRedirect('http://127.0.0.1:5174', 'recovery'), 'http://127.0.0.1:5174/auth/recovery');
  assert.equal(authRedirect('https://example.test/unsafe?next=https://evil.test'), 'https://example.test/auth/callback');
});
test('callback parsing rejects unrelated paths and does not reflect provider error details', () => {
  assert.equal(readAuthCallback('https://example.test/?code=secret'), null);
  assert.deepEqual(readAuthCallback('https://example.test/auth/callback?code=abc&next=https://evil.test'), {recovery:false,code:'abc',failed:false});
  assert.deepEqual(readAuthCallback('https://example.test/auth/recovery?error=denied&error_description=private'), {recovery:true,code:null,failed:true});
});
