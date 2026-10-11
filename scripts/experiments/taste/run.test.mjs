import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeRun } from './pipeline.mjs';

const runner = fileURLToPath(new URL('./run.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('./pilot.json', import.meta.url));

test('default CLI run only plans the proposed fixture without credentials', () => {
  const result = spawnSync(process.execPath, [runner, fixture], {
    encoding: 'utf8',
    env: {},
  });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.live, false);
  assert.equal(plan.requests, 12);
  assert.equal(plan.representation, 'description-only');
});

test('CLI can evaluate reused results without a key and refuses to overwrite them', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'taste-test-'));
  try {
    const dataset = JSON.parse(readFileSync(fixture, 'utf8'));
    dataset.judgmentsStatus = 'human-reviewed'; // Mocked fixture only; not a real review.
    const cache = await executeRun(dataset, { providers: {
      embedding: async () => ({ vector: [1, 0], dimensions: 2, usage: null, latencyMs: 1 }),
      labels: async () => ({ labels: { styles: ['absurdist'], topics: [], explanation: 'Test fixture.' }, usage: null, latencyMs: 1 }),
    } });
    const input = join(directory, 'dataset.json'), previous = join(directory, 'previous.json'), output = join(directory, 'output.json');
    writeFileSync(input, JSON.stringify(dataset));
    writeFileSync(previous, JSON.stringify(cache));
    const args = [runner, input, '--live', output, '--reuse', previous];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: {} });
    assert.equal(result.status, 0, result.stderr);
    const run = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(run.status, 'complete');
    assert.equal(run.requestsMade, 0);
    assert.equal(run.evaluation.combined.total, dataset.comparisons.length);
    assert.equal(statSync(output).mode & 0o777, 0o600);
    const original = readFileSync(output, 'utf8');
    assert.notEqual(spawnSync(process.execPath, args, { env: {} }).status, 0);
    assert.equal(readFileSync(output, 'utf8'), original);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('live CLI refuses unreviewed judgments before requiring credentials or output', () => {
  const result = spawnSync(process.execPath, [runner, fixture, '--live'], {
    encoding: 'utf8',
    env: {},
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Review comparison judgments before live evaluation/);
});
