import test from 'node:test';
import assert from 'node:assert/strict';
import {authRedirect, authLinkFailure, readAuthCallback} from '../src/auth-links.ts';

test('auth redirects stay on the app origin with fixed routes', () => {
  assert.equal(authRedirect('https://example.test/'), 'https://example.test/auth/callback');
  assert.equal(authRedirect('http://127.0.0.1:5174', 'recovery'), 'http://127.0.0.1:5174/auth/recovery');
  assert.equal(authRedirect('https://example.test/unsafe?next=https://evil.test'), 'https://example.test/auth/callback');
});
test('callback parsing rejects unrelated paths and does not reflect provider error details', () => {
  assert.equal(readAuthCallback('https://example.test/?code=secret'), null);
  assert.deepEqual(readAuthCallback('https://example.test/auth/callback?code=abc&next=https://evil.test'), {recovery:false,code:'abc',flowId:null,errorCode:null,failed:false});
  assert.deepEqual(readAuthCallback('https://example.test/auth/recovery?error=denied&error_description=private'), {recovery:true,code:null,flowId:null,errorCode:null,failed:true});
});
test('callback retains the explicit PKCE slot, including invalid empty IDs for fail-closed validation', () => {
  assert.equal(readAuthCallback('https://example.test/auth/recovery?code=abc&sb_flow_id=flow-a')?.flowId, 'flow-a');
  assert.equal(readAuthCallback('https://example.test/auth/recovery?code=abc&sb_flow_id=')?.flowId, '');
});
test('callback errors expose only whitelisted static guidance', () => {
  assert.equal(authLinkFailure('flow_state_expired'), 'authLinkExpired');
  assert.equal(authLinkFailure('otp_expired'), 'authLinkExpired');
  assert.equal(authLinkFailure('pkce_code_verifier_not_found'), 'authLinkBrowser');
  assert.equal(authLinkFailure('private-provider-message'), 'authLinkError');
  assert.equal(authLinkFailure(null), 'authLinkError');
});
