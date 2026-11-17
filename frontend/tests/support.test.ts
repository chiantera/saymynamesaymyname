import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../shared/crisis-resources.json' with { type: 'json' };
import { countries, emergencyResources, supportKinds, supportPathKey, validSupportKind, quickExitURL } from '../src/support-resources.ts';
const now = new Date('2026-11-17T12:00:00Z');
test('explicit country only; no language, timezone or worldwide emergency assumption', () => {
  for (const invalid of ['', 'en', 'it', 'zh-Hans', 'Europe/Berlin', 'ZZ', 'us']) {
    assert.deepEqual(emergencyResources(invalid, now).services, []);
  }
  assert.equal(emergencyResources('IT', now).services[0].number, '112');
  assert.equal(emergencyResources('US', now).services[0].number, '911');
  assert.equal(emergencyResources('HK', now).services[0].number, '999');
  assert.deepEqual(emergencyResources('KR', now).services, [{kind:'police',number:'112'},{kind:'medical_fire',number:'119'}]);
  assert.deepEqual(emergencyResources('CN', now).services.map(x => x.number), ['110','120','119']);
});
test('expired, future and invalid-clock contact facts hide dial buttons but retain official source', () => {
  for (const date of ['2027-02-15T00:00:00Z','2026-11-16T23:59:59Z','invalid']) {
    const result = emergencyResources('DE', new Date(date));
    assert.equal(result.stale, true); assert.deepEqual(result.services, []);
    assert.match(result.source!, /^https:\/\//);
  }
});
test('catalog is curated, unique and review gated; no model-provided URLs or numbers', () => {
  assert.equal(new Set(countries).size, countries.length);
  assert.equal(countries.length, 32);
  assert.equal(catalog.automatic_crisis_copy, false);
  assert.equal(catalog.professional_copy_reviewed, false);
  for (const locale of ['en','it','es','de','ko','zh-Hans','yue-Hant','unknown']) {
    for (const kind of supportKinds) assert.equal(supportPathKey(kind, locale), 'supportPath_manual');
  }
  for (const region of catalog.regions) {
    assert.match(region.source, /^https:\/\//);
    assert.ok(Date.parse(region.valid_until) - Date.parse(region.verified_on) <= 90 * 86400000);
    for (const service of region.services) assert.match(service.number, /^\d{3}$/);
  }
  assert.equal(quickExitURL, 'https://www.wikipedia.org/');
  assert.equal(validSupportKind('self_harm'), 'self_harm');
  assert.equal(validSupportKind('<script>'), 'unavailable');
});
