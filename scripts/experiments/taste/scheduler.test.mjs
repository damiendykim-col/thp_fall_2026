import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from './scheduler.mjs';

function clock() {
  let time = 0;
  return { now: () => time, sleep: async ms => { time += ms; } };
}
test('separate model pacing persists attempts and total budget across resume', async () => {
  const state = { attempts: [] }, timing = clock();
  const scheduler = createScheduler(state, { ...timing, maxRequests: 3 });
  await scheduler.fetch('labels')('url', { body: '{}' }, async () => ({ status: 200 }));
  await scheduler.fetch('embedding')('url', { body: '{}' }, async () => ({ status: 200 }));
  assert.equal(timing.now(), 0);
  await scheduler.fetch('labels')('url', { body: '{}' }, async () => ({ status: 200 }));
  assert.ok(timing.now() >= 6000);
  const resumed = createScheduler(state, { ...timing, maxRequests: 3 });
  await assert.rejects(() => resumed.fetch('embedding')('url', {}, async () => ({ status: 200 })), /budget/);
  assert.equal(state.attempts.length, 3);
});
test('429 retries are bounded, respect Retry-After, and count against budget', async () => {
  const state = { attempts: [] }, timing = clock();
  let calls = 0;
  const scheduler = createScheduler(state, { ...timing, maxRequests: 5 });
  const result = await scheduler.fetch('labels')('url', {}, async () => {
    calls++;
    return { status: calls < 3 ? 429 : 200, headers: { get: () => '90' } };
  });
  assert.equal(result.status, 200);
  assert.equal(calls, 3);
  assert.equal(state.attempts.length, 3);
  assert.ok(timing.now() >= 210000);
});
test('token reservations wait for rolling window and reject oversized individual requests', async () => {
  const state = { attempts: [] }, timing = clock();
  const scheduler = createScheduler(state, { ...timing, maxRequests: 4, limits: { labels: { rpm: 10, tpm: 10, allowance: 100 } } });
  await scheduler.fetch('labels')('url', { body: '123456' }, async () => ({ status: 200 }));
  await scheduler.fetch('labels')('url', { body: '123456' }, async () => ({ status: 200 }));
  assert.ok(timing.now() >= 60000);
  await assert.rejects(() => scheduler.fetch('labels')('url', { body: '12345678901' }), /token/);
});
test('records before sending, does not retry timeouts or authentication failures', async () => {
  const state = { attempts: [] }, timing = clock();
  let saved = 0, calls = 0;
  const scheduler = createScheduler(state, { ...timing, checkpoint: () => { saved++; } });
  await assert.rejects(() => scheduler.fetch('labels')('url', {}, async () => {
    calls++; assert.equal(saved, 1); throw new Error('network timeout');
  }), /network failure/);
  const response = await scheduler.fetch('labels')('url', {}, async () => { calls++; return { status: 401 }; });
  assert.equal(response.status, 401);
  assert.equal(calls, 2);
});
