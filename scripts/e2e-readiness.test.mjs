import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForBackend } from './e2e-readiness.mjs';

const env = { url: 'http://127.0.0.1:55421', anonKey: 'local-anon', serviceKey: 'local-service' };
const ready = (url) => Response.json(url.includes('/rest/') ? [{ id: 1 }, { id: 2 }] : url.includes('/storage/') ? [{ id: 'challenge-images' }, { id: 'avatars' }] : { version: 'test' });

test('requires successful Auth, seeded REST and Storage responses with scoped credentials', async () => {
  const calls = [];
  await waitForBackend(env, { fetchImpl: async (url, options) => { calls.push([url, options]); return ready(url); } });
  assert.equal(calls.length, 3);
  assert.equal(calls.find(([url]) => url.includes('/rest/'))[1].headers.apikey, env.anonKey);
  assert.equal(calls.find(([url]) => url.includes('/storage/'))[1].headers.Authorization, `Bearer ${env.serviceKey}`);
});

test('401/404, missing fixtures and missing buckets never count as healthy', async () => {
  for (const fetchImpl of [async () => new Response('', { status: 401 }), async () => new Response('', { status: 404 }), async () => Response.json([])]) {
    await assert.rejects(waitForBackend(env, { fetchImpl, attempts: 1 }), /not ready/);
  }
});

test('retries transient failures, bounds attempts and does not echo response bodies', async () => {
  let calls = 0;
  let waits = 0;
  await waitForBackend(env, { attempts: 2, sleep: async () => { waits++; }, fetchImpl: async url => ++calls <= 3 ? new Response('secret', { status: 503 }) : ready(url) });
  assert.equal(waits, 1);
  await assert.rejects(waitForBackend(env, { attempts: 1, fetchImpl: async () => { throw new Error('secret'); } }), error => !error.message.includes('secret') && error.message.includes('not ready'));
});
