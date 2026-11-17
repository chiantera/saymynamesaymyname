import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const ts = require('typescript');

const locales = ['en', 'it', 'es', 'ko', 'zh-Hans', 'yue-Hant', 'de'];
let expected;
let english;
for (const locale of locales) {
  const catalog = JSON.parse(
    await readFile(new URL(`../shared/locales/${locale}.json`, import.meta.url), 'utf8'),
  );
  const keys = Object.keys(catalog).sort();
  if (locale === 'en') english = catalog;
  if (!expected) expected = keys;
  assert.deepEqual(keys, expected, `${locale}: missing or extra keys`);
  assert.ok(
    Object.values(catalog).every((value) => typeof value === 'string' && value.trim()),
    `${locale}: empty translation`,
  );
  for (const key of keys) {
    const slots = (text) => [...text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)]
      .map((match) => match[1]).sort();
    assert.deepEqual(slots(catalog[key]), slots(english[key]), `${locale}.${key}: interpolation mismatch`);
  }
}
console.log(
  `Seven catalogs checked: ${expected.length} non-empty keys each. Human review still required.`,
);

// Guard against accidental Windows cp1252/UTF-8 round trips in UI source.
// Every TypeScript file under frontend/src is scanned, including new folders.
const sourceRoot = fileURLToPath(new URL('../frontend/src', import.meta.url));
const sources = (await readdir(sourceRoot, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
  .map((entry) => join(entry.parentPath, entry.name));
assert.ok(sources.length > 0, 'No UI source files found');
for (const file of sources) {
  const source = await readFile(file, 'utf8');
  const name = relative(sourceRoot, file);
  assert.ok(!/\u00e2[\u20ac\u2014\u0152\u0161]/.test(source), `${name}: mojibake in UI source`);
  assert.ok(!source.includes('\ufffd'), `${name}: replacement character`);
  const tree = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true,
    name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const checkKey = (key) => assert.ok(Object.hasOwn(english, key), `${name}: missing UI key ${key}`);
  const literalKeys = (node) => {
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) checkKey(node.text);
    else if (ts.isConditionalExpression(node)) {
      literalKeys(node.whenTrue);
      literalKeys(node.whenFalse);
    }
  };
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      literalKeys(node.arguments[0]);
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'labelKey') literalKeys(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(tree);
}
// Explicit contracts for dynamic status/capability and planned-feature lists.
for (const key of [
  ...['reserved', 'started', 'unknown', 'estimated', 'reconciled', 'cancelled'].map(s => `budgetState_${s}`),
  ...['chat', 'ocr', 'transcription'].map(s => `aiCapability_${s}`),
  ...['Goals', 'Habits', 'Milestones', 'Streaks'].map(s => `growthPlan${s}`),
  ...['Talk', 'Drafts', 'Context'].map(s => `bartenderPlan${s}`),
  ...['Therapy', 'Provider', 'Private'].map(s => `bartenderLimit${s}`),
]) assert.ok(Object.hasOwn(english, key), `Missing dynamic UI key ${key}`);
console.log(`${sources.length} UI source files checked for mojibake.`);
