import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const locales = ['en', 'it', 'es', 'ko', 'zh-Hans', 'yue-Hant', 'de'];
let expected;
for (const locale of locales) {
  const catalog = JSON.parse(await readFile(new URL(`../shared/locales/${locale}.json`, import.meta.url), 'utf8'));
  const keys = Object.keys(catalog).sort();
  if (!expected) expected = keys;
  assert.deepEqual(keys, expected, `${locale}: missing or extra keys`);
  assert.ok(Object.values(catalog).every(value => typeof value === 'string' && value.trim()), `${locale}: empty translation`);
}
console.log(`Seven catalogs checked: ${expected.length} non-empty keys each. Human review still required.`);

// Guard against accidental Windows cp1252/UTF-8 round trips in UI source.
for (const file of ['App.tsx', 'AuthGate.tsx', 'Relationships.tsx', 'invitation-links.ts', 'auth-bootstrap.ts', 'domain.ts', 'i18n.ts']) {
  const source = await readFile(new URL(`../frontend/src/${file}`, import.meta.url), 'utf8');
  assert.ok(!/\u00e2[\u20ac\u2014\u0152\u0161]/.test(source), `${file}: mojibake in UI source`);
  assert.ok(!source.includes('\ufffd'), `${file}: replacement character`);
}
