import { test } from 'node:test';
import assert from 'node:assert/strict';
import { label, buildLabelRequest } from './labels.mjs';

const request = buildLabelRequest({ scene: 'A desk.', caption: 'My deadline moved in.' });
const labels = { styles: ['absurdist'], topics: ['work'], explanation: 'Personifies a deadline.' };

test('label provider uses independent model, structured output, and excludes thought parts', async () => {
  const result = await label(request, 'fake-key', 'test-label-model', async (url, options) => {
    assert.ok(url.endsWith('/test-label-model:generateContent'));
    assert.equal(JSON.parse(options.body).generationConfig.responseMimeType, 'application/json');
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [
      { thought: true, text: 'not JSON' }, { text: JSON.stringify(labels) },
    ] } }], usageMetadata: { totalTokenCount: 50 } }) };
  });
  assert.deepEqual(result.labels, labels);
  assert.equal(result.usage.totalTokenCount, 50);
});

test('label provider fails safely for rate limit, blocked, incomplete and malformed output', async () => {
  let calls = 0;
  await assert.rejects(() => label(request, 'fake-key', undefined, async () => {
    calls++;
    return { ok: false, status: 429 };
  }), /429/);
  assert.equal(calls, 1);
  for (const candidate of [undefined, { finishReason: 'MAX_TOKENS' },
    { finishReason: 'STOP', content: { parts: [{ text: 'private provider text' }] } }]) {
    await assert.rejects(() => label(request, 'fake-key', undefined, async () => ({
      ok: true, json: async () => ({ candidates: candidate ? [candidate] : [] }),
    })), error => !error.message.includes('private provider text'));
  }
});
