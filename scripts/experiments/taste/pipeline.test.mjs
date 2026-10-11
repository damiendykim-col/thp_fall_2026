import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRun, executeRun, compareRepresentations } from './pipeline.mjs';
import { buildLabelRequest, validateLabels, STYLES } from './labels.mjs';

const dataset = {
  judgmentsStatus: 'human-reviewed',
  items: ['a', 'b', 'c'].map(id => ({ id, scene: 'A desk', caption: `Caption ${id}` })),
  comparisons: [{ anchor: 'a', positive: 'b', negative: 'c' }],
};
const labels = { styles: ['absurdist'], topics: ['work'], explanation: 'An absurd situation.' };
const providers = {
  embedding: async () => ({ vector: [1, 0], dimensions: 2, latencyMs: 1, usage: null }),
  labels: async () => ({ labels, latencyMs: 1, usage: null }),
};

test('plan bounds both provider roles and excludes identity/origin/judgments from inputs', () => {
  const plan = planRun(dataset);
  assert.equal(plan.requests, 6);
  const request = buildLabelRequest({ ...dataset.items[0], origin: 'human', email: 'secret', expectedStyle: 'dark' });
  assert.ok(!JSON.stringify(request).includes('secret'));
  assert.ok(!JSON.stringify(request).includes('expectedStyle'));
  assert.throws(() => planRun({ ...dataset, items: Array(13).fill(dataset.items[0]) }));
});

test('labels reject unknown styles, duplicate labels, missing explanation and extra fields', () => {
  assert.deepEqual(validateLabels(labels), labels);
  for (const bad of [
    { ...labels, styles: ['invented'] }, { ...labels, styles: ['absurdist', 'absurdist'] },
    { ...labels, explanation: '' }, { ...labels, personality: 'sensitive inference' },
  ]) assert.throws(() => validateLabels(bad));
  assert.ok(STYLES.includes('wordplay'));
});

test('completed work is reused; input and model changes invalidate only affected records', async () => {
  const run = await executeRun(dataset, { providers });
  assert.equal(run.records.length, 6);
  assert.equal(planRun(dataset, { previous: run }).requests, 0);
  const changed = structuredClone(dataset);
  changed.items[0].caption = 'Changed caption';
  assert.equal(planRun(changed, { previous: run }).requests, 2);
  assert.equal(planRun(dataset, { previous: run, labelModel: 'other-model' }).requests, 3);
  assert.equal(planRun(dataset, { previous: run, embeddingModel: 'other-embedding' }).requests, 3);
});

test('failure checkpoints preserve earlier work and retry only missing operations', async () => {
  let snapshot;
  await assert.rejects(() => executeRun(dataset, {
    providers: { ...providers, labels: async () => { throw new Error('quota'); } },
    checkpoint: run => { snapshot = structuredClone(run); },
  }), /quota/);
  assert.equal(snapshot.status, 'failed');
  assert.equal(snapshot.records.length, 1);
  assert.equal(planRun(dataset, { previous: snapshot }).requests, 5);
});

test('corrupt cached vectors fail before calls and zero-evidence styles are not agreement', async () => {
  const run = await executeRun(dataset, { providers });
  run.records[0].result.vector = [0, 0];
  assert.throws(() => planRun(dataset, { previous: run }), /vector/i);
  const report = compareRepresentations(dataset, {
    a: { vector: [1, 0], labels: { ...labels, styles: [] } },
    b: { vector: [1, 0], labels }, c: { vector: [0, 1], labels },
  }, 0.5);
  assert.equal(report.embeddings.wins, 1);
  assert.equal(report.styles.insufficient, 1);
  assert.equal(report.combined.insufficient, 1);
});

test('combined score records a fixed weight and reports representation disagreements', () => {
  const report = compareRepresentations(dataset, {
    a: { vector: [1, 0], labels },
    b: { vector: [1, 0], labels: { ...labels, styles: ['wordplay'] } },
    c: { vector: [0, 1], labels },
  }, 0.5);
  assert.equal(report.embeddings.wins, 1);
  assert.equal(report.styles.losses, 1);
  assert.equal(report.combined.ties, 1);
  assert.equal(report.disagreements.length, 1);
  assert.equal(report.embeddingWeight, 0.5);
});
