import assert from 'node:assert/strict';
import test from 'node:test';
import { clockMinutes, describeDay, usableTimezone, zonedMoment } from '../src/day-band.ts';
import type { Checkin } from '../src/api.ts';

test('day band rejects malformed clocks and invalid timezone names', () => {
  for (const value of ['12:99', '24:00', '-1:00', '09:30junk', '09:30:11']) {
    assert.equal(clockMinutes(value), null, value);
  }
  assert.equal(clockMinutes('08:30:00'), 510);
  assert.equal(clockMinutes('22:00'), 1320);
  assert.equal(usableTimezone('not-a-timezone'), undefined);
  assert.equal(usableTimezone('Europe/Berlin'), 'Europe/Berlin');
});

test('day band uses local calendar days and half-open overnight quiet hours', () => {
  const early = describeDay(Date.parse('2026-11-17T06:59:00Z'), 'Europe/Berlin', '22:00', '08:00', []);
  assert.deepEqual(early.quiet, [{start: 0, end: 480}, {start: 1320, end: 1440}]);
  assert.equal(early.quietNow, true);
  assert.equal(describeDay(Date.parse('2026-11-17T07:00:00Z'), 'Europe/Berlin', '22:00', '08:00', []).quietNow, false);
  assert.equal(zonedMoment(Date.parse('2026-11-16T23:30:00Z'), 'Europe/Berlin')?.day, '2026-11-17');
});

test('day band reflects real records only and keeps next-day snooze off today’s track', () => {
  const records = [
    {id:'yesterday', status:'fulfilled', created_at:'2026-11-16T21:00:00Z'},
    {id:'today', status:'deferred', created_at:'2026-11-17T12:00:00Z', snoozed_until:'2026-11-18T07:00:00Z'},
    {id:'invalid', status:'skipped', created_at:'invalid'},
  ] as Checkin[];
  const model=describeDay(Date.parse('2026-11-17T18:00:00Z'),'Europe/Berlin','22:00','08:00',records);
  assert.deepEqual(model.marks,[{id:'today',status:'deferred',minutes:780}]);
  assert.equal(model.snooze?.minutes,null);
  assert.equal(describeDay(Date.now(),'UTC','08:00','08:00',[]).marks.length,0);
});

test('day band is a wall-clock view across the repeated DST hour', () => {
  const first=zonedMoment(Date.parse('2026-10-25T00:30:00Z'),'Europe/Berlin');
  const second=zonedMoment(Date.parse('2026-10-25T01:30:00Z'),'Europe/Berlin');
  assert.deepEqual(first,second);
  assert.deepEqual(first,{day:'2026-10-25',minutes:150});
});
