import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importChallenges } from './import.mjs';

const row = { challenge_id: 'challenge-1', status: 'published', closes_at: '2026-01-01T00:00:00Z',
  hidden_at: null, scene: 'A person at a desk.', description_source: 'template',
  captions: [{ id: 'caption-a', body: 'A joke' }, { id: 'caption-b', body: 'Another joke' }] };

test('import retains provenance but strips authors, origins, votes and private profile fields', () => {
  const dataset = importChallenges([{ ...row, email: 'secret', creator_id: 'secret',
    captions: row.captions.map(caption => ({ ...caption, origin: 'human', votes: 12 })) }]);
  assert.equal(dataset.items.length, 2);
  assert.equal(dataset.items[0].source.challengeId, 'challenge-1');
  assert.equal(dataset.judgmentsStatus, 'proposed-not-human-reviewed');
  assert.deepEqual(dataset.comparisons, []);
  assert.ok(!JSON.stringify(dataset).includes('secret'));
  assert.ok(!JSON.stringify(dataset).includes('origin'));
});

test('import rejects open, hidden, incomplete and oversized samples', () => {
  for (const bad of [{ ...row, closes_at: '2999-01-01' }, { ...row, hidden_at: '2026-01-01' },
    { ...row, captions: row.captions.slice(0, 1) }, { ...row, status: 'ready' }]) {
    assert.throws(() => importChallenges([bad]));
  }
  assert.throws(() => importChallenges(Array(7).fill(row)));
});
