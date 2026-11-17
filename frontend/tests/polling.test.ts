import test from 'node:test';
import assert from 'node:assert/strict';
import { pollDelay, startPolling, type PollHost } from '../src/polling.ts';

function clock() {
  let visible = true;
  let listener = () => {};
  const timers = new Map<number, {callback: () => void; delay: number}>();
  let id = 0;
  const host: PollHost = {
    visible: () => visible,
    schedule(callback, delay) { timers.set(++id, {callback, delay}); return id; },
    cancel(key) { timers.delete(key as number); },
    subscribe(callback) { listener = callback; return () => { listener = () => {}; }; },
  };
  return { host, timers,
    visibility(value: boolean) { visible = value; listener(); },
    fire() { const [key, value] = [...timers][0]; timers.delete(key); value.callback(); },
    delay() { assert.equal(timers.size, 1); return [...timers.values()][0].delay; },
  };
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test('cloud idle/active and bounded error delays keep the local demo responsive', () => {
  assert.equal(pollDelay(true, false), 30000);
  assert.equal(pollDelay(true, true), 5000);
  assert.equal(pollDelay(false, false), 1500);
  assert.deepEqual([1,2,3,50].map(n => pollDelay(true,true,n)), [30000,60000,60000,60000]);
});

test('slow reads never overlap and unmount does not reschedule a pending read', async () => {
  const c = clock(); let calls = 0; let release = () => {};
  const stop = startPolling(() => { ++calls; return new Promise<void>(resolve => { release = resolve; }); },
    {host:c.host, delay:() => 30000});
  assert.equal(calls,1); assert.equal(c.timers.size,0);
  c.visibility(false); c.visibility(true); c.visibility(true);
  assert.equal(calls,1);
  stop(); release(); await settled();
  assert.equal(c.timers.size,0);
  c.visibility(true); assert.equal(calls,1);
});

test('hidden tabs stop polling and returning makes one fresh read without a backlog', async () => {
  const c=clock(); let calls=0;
  const stop=startPolling(async () => { ++calls; }, {host:c.host,delay:()=>30000,immediate:false});
  assert.equal(calls,0); assert.equal(c.delay(),30000);
  c.visibility(false); assert.equal(c.timers.size,0);
  c.visibility(true); await settled();
  assert.equal(calls,1); assert.equal(c.delay(),30000);
  c.visibility(false); c.visibility(true); await settled();
  assert.equal(calls,2); assert.equal(c.timers.size,1); stop();
});

test('failures back off, success resets, and delay follows current job state', async () => {
  const c=clock(); let broken=true; let active=false; let errors=0;
  const stop=startPolling(async () => { if (broken) throw new Error('fixture'); },
    {host:c.host,delay:n=>pollDelay(true,active,n),onError:()=>++errors});
  await settled(); assert.equal(c.delay(),30000);
  c.fire(); await settled(); assert.equal(c.delay(),60000); assert.equal(errors,2);
  broken=false; active=true; c.fire(); await settled(); assert.equal(c.delay(),5000);
  active=false; c.fire(); await settled(); assert.equal(c.delay(),30000); stop();
});
