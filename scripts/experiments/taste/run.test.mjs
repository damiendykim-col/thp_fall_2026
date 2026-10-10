import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
  assert.equal(plan.requests, 6);
  assert.equal(plan.representation, 'description-only');
});

test('live CLI refuses unreviewed judgments before requiring credentials or output', () => {
  const result = spawnSync(process.execPath, [runner, fixture, '--live'], {
    encoding: 'utf8',
    env: {},
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Review comparison judgments before live evaluation/);
});
