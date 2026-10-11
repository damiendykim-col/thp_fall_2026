import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildMechanismRequest, validateMechanisms } from './mechanisms.mjs';
import { planRun, executeRun } from './pipeline.mjs';

const item = { id: 'a', scene: 'Private scene marker', caption: 'My syllabus wants custody of my weekends.' };
const analysis = { mechanisms: [{ label: 'personification', evidence: 'syllabus wants custody', uncertainty: 'supported' }],
  delivery: [], topics: ['college'], explanation: 'Treats a syllabus as a person.' };
const dataset = { judgmentsStatus: 'human-reviewed', items: ['a', 'b', 'c'].map(id => ({ ...item, id, caption: item.caption + id })),
  comparisons: [{ anchor: 'a', positive: 'b', negative: 'c' }] };

test('v2 request stays byte-identical and v3 keeps scene out of caption-only input', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(buildMechanismRequest(item))).digest('hex'),
    '0aa8609329f3a40a1011ae071524565bd5b51280a6778ddf311bd70cfdf8e035');
  const request = buildMechanismRequest(item, 'caption-only', 'mechanisms-v3');
  assert.ok(!JSON.stringify(request).includes(item.scene));
  assert.deepEqual(request.generationConfig.responseJsonSchema, buildMechanismRequest(item).generationConfig.responseJsonSchema);
});

test('caption-only excludes scene in both model roles; v1 scene embeddings remain reusable', async () => {
  const options = { taxonomy: 'mechanisms-v2', representation: 'caption-only' };
  const plan = planRun(dataset, options);
  for (const operation of plan.operations) assert.ok(!JSON.stringify(operation.request).includes(item.scene));
  assert.match(JSON.stringify(buildMechanismRequest(item, 'caption-only')), /double meaning/);
  const old = await executeRun(dataset, { providers: {
    embedding: async () => ({ vector: [1, 0], dimensions: 2 }),
    labels: async () => ({ labels: { styles: ['ironic'], topics: ['college'], explanation: 'Test' } }),
  } });
  assert.equal(planRun(dataset, { taxonomy: 'mechanisms-v2', previous: old }).requests, 3);
  assert.equal(planRun(dataset, { ...options, previous: old }).requests, 6);
});

test('mechanisms require evidence and uncertainty and reject mixed or invented fields', () => {
  assert.deepEqual(validateMechanisms(analysis), analysis);
  for (const mechanism of [{ label: 'personification' }, { label: 'invented', evidence: 'text', uncertainty: 'supported' },
    { label: 'personification', evidence: '', uncertainty: 'supported' }]) {
    assert.throws(() => validateMechanisms({ ...analysis, mechanisms: [mechanism] }));
  }
  assert.throws(() => validateMechanisms({ ...analysis, styles: ['ironic'] }));
});

test('v2 separates delivery and topics from mechanism score and abstains on uncertain evidence', async () => {
  const run = await executeRun(dataset, { taxonomy: 'mechanisms-v2', providers: {
    embedding: async () => ({ vector: [1, 0], dimensions: 2 }),
    labels: async () => ({ labels: { ...analysis, mechanisms: analysis.mechanisms.map(m => ({ ...m, uncertainty: 'uncertain' })) } }),
  } });
  assert.equal(run.evaluation.mechanisms.insufficient, 1);
  assert.equal(run.evaluation.delivery.insufficient, 1);
  assert.equal(run.evaluation.combined.insufficient, 1);
  assert.equal(run.taxonomy, 'mechanisms-v2');
});

test('v3 reuses embeddings but invalidates v2 labels and preserves abstention scoring', async () => {
  const providers = {
    embedding: async () => ({ vector: [1, 0], dimensions: 2 }),
    labels: async () => ({ labels: analysis }),
  };
  const old = await executeRun(dataset, { taxonomy: 'mechanisms-v2', providers });
  const options = { taxonomy: 'mechanisms-v3', previous: old };
  const plan = planRun(dataset, options);
  assert.equal(plan.requests, 3);
  assert.ok(plan.operations.filter(o => o.kind === 'labels').every(o => o.version === 'taste-mechanisms-v3'));
  let labelCalls = 0;
  const run = await executeRun(dataset, { ...options, providers: {
    embedding: async () => { throw new Error('Embedding should be reused'); },
    labels: async () => { labelCalls++; return { labels: { ...analysis, mechanisms: [] } }; },
  } });
  assert.equal(labelCalls, 3);
  assert.equal(run.evaluation.mechanisms.insufficient, 1);
  assert.equal(planRun(dataset, { taxonomy: 'mechanisms-v3', previous: run }).requests, 0);
});
