import test from 'node:test';
import assert from 'node:assert/strict';
import {emailKey, invitationLink, invitationToken} from '../src/invitation-links.ts';

const token = 'a'.repeat(64);
test('invitation secrets use strict fragments, not query strings or arbitrary routes', () => {
  assert.equal(invitationToken(`https://app.test/join#invite=${token}`),token);
  assert.equal(invitationToken(`https://app.test/join?invite=${token}`),null);
  assert.equal(invitationToken(`https://app.test/other#invite=${token}`),null);
  assert.equal(invitationToken(`https://app.test/join#invite=${token}&next=https://evil.test`),null);
  assert.equal(invitationToken('https://app.test/join#invite=short'),null);
});
test('invitation link builder preserves only the intended app origin and validated secret', () => {
  assert.equal(invitationLink('https://app.test/other?next=evil',token),`https://app.test/join#invite=${token}`);
  assert.throws(() => invitationLink('https://app.test','invalid'));
});

test('gmail addresses compare by mailbox; other providers only ignore case', () => {
  assert.equal(emailKey(' First.Last+tag@GoogleMail.com '), 'firstlast@gmail.com');
  assert.equal(emailKey('firstlast@gmail.com'), 'firstlast@gmail.com');
  assert.equal(emailKey('First.Last+tag@example.org'), 'first.last+tag@example.org');
  assert.notEqual(emailKey('first.last@example.org'), emailKey('firstlast@example.org'));
});
