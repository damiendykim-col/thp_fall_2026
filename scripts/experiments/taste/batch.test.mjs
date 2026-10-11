import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareJob, inspectJob, runJob } from './batch.mjs';

const dataset = { judgmentsStatus: 'human-reviewed', split: 'development', items: ['a', 'b', 'c'].map(id => ({ id, scene: 'A desk', caption: `Caption ${id}` })), comparisons: [{ anchor: 'a', positive: 'b', negative: 'c' }] };
function mockResponse(url) {
  return { ok: true, status: 200, json: async () => url.endsWith(':embedContent') ? { embedding: { values: [1, 0] } } : {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ mechanisms: [{ label: 'personification', evidence: 'caption', uncertainty: 'supported' }], delivery: [], topics: [], explanation: 'Test fixture' }) }] } }],
  } };
}
function timing() {
  let time = 0;
  return { now: () => time, sleep: async ms => { time += ms; } };
}
test('both conditions finish, aggregate separately and completed resume makes no calls', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'taste-batch-'));
  try {
    const job = prepareJob([dataset]);
    assert.equal(inspectJob(job, directory).missingRequests, 12);
    let calls = 0;
    const report = await runJob(job, directory, { key: 'fake', timing: timing(), log: () => {}, fetcher: async url => { calls++; return mockResponse(url); } });
    assert.equal(calls, 12);
    assert.equal(report.conditions['caption-only'].scores.mechanisms.total, 1);
    assert.equal(report.conditions['description-only'].scores.mechanisms.total, 1);
    await runJob(job, directory, { timing: timing(), log: () => {}, fetcher: async () => { throw new Error('Must not fetch'); } });
    assert.equal(inspectJob(job, directory).state.attempts.length, 12);
    assert.throws(() => inspectJob(prepareJob([dataset], { maxRequests: 81 }), directory), /configuration changed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('partial failure resumes missing work only and preserves failed attempt in ledger', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'taste-batch-'));
  try {
    const job = prepareJob([dataset], { conditions: ['caption-only'] });
    let calls = 0;
    const clock = timing();
    await assert.rejects(() => runJob(job, directory, { key: 'fake', timing: clock, log: () => {}, fetcher: async url => {
      calls++; if (calls === 2) throw new Error('offline'); return mockResponse(url);
    } }), /network failure/);
    assert.equal(inspectJob(job, directory).missingRequests, 5);
    await runJob(job, directory, { key: 'fake', timing: clock, log: () => {}, fetcher: async url => { calls++; return mockResponse(url); } });
    assert.equal(calls, 7);
    assert.equal(JSON.parse(readFileSync(join(directory, 'job.json'))).attempts.length, 7);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('underbudget job refuses before network and before writing output', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'taste-batch-'));
  try {
    await assert.rejects(() => runJob(prepareJob([dataset], { maxRequests: 1 }), directory, { key: 'fake' }), /budget/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
