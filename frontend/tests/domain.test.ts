import test from 'node:test';
import assert from 'node:assert/strict';
import { canGenerate, resolveLocale } from '../src/domain.ts';

test('locale matching distinguishes Cantonese and Mandarin, with honest unknown fallback', () => {
  assert.equal(resolveLocale('de-DE'), 'de');
  assert.equal(resolveLocale('zh-CN'), 'zh-Hans');
  assert.equal(resolveLocale('zh-HK'), 'yue-Hant');
  assert.equal(resolveLocale('yue-Hant'), 'yue-Hant');
  assert.equal(resolveLocale('unsupported'), 'en');
});
test('queued, processing, pending and snoozed work prevent duplicate creation', () => {
  assert.equal(canGenerate(['pending'], []), false);
  assert.equal(canGenerate(['deferred'], []), false);
  assert.equal(canGenerate([], ['processing']), false);
  assert.equal(canGenerate(['skipped', 'fulfilled'], ['failed']), true);
});
