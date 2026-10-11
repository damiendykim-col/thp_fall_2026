import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMechanismRequest, validateMechanisms } from './mechanisms.mjs';
import { planRun, executeRun } from './pipeline.mjs';

const item = { id: 'a', scene: 'Private scene marker', caption: 'My syllabus wants custody of my weekends.' };
const analysis = { mechanisms: [{ label: 'personification', evidence: 'syllabus wants custody', uncertainty: 'supported' }],
  delivery: [], topics: ['college'], explanation: 'Treats a syllabus as a person.' };
const dataset = { judgmentsStatus: 'human-reviewed', items: ['a', 'b', 'c'].map(id => ({ ...item, id, caption: item.caption + id })),
  comparisons: [{ anchor: 'a', positive: 'b', negative: 'c' }] };

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
