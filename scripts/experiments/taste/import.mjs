import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildRequest } from './evaluate.mjs';

export function importChallenges(rows, now = Date.now()) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 6) throw new Error('Select 1–6 closed challenges');
  const items = rows.flatMap(row => {
    const closes = Date.parse(row.closes_at);
    if (row.status !== 'published' || row.hidden_at !== null || !Number.isFinite(closes) || closes > now ||
        typeof row.challenge_id !== 'string' || !row.challenge_id ||
        !Array.isArray(row.captions) || row.captions.length !== 2) throw new Error('Require visible, closed, published challenges with two captions');
    return row.captions.map(caption => {
      if (typeof caption.id !== 'string' || !caption.id) throw new Error('Caption ID required');
      const item = { id: caption.id, scene: row.scene, caption: caption.body,
        source: { challengeId: row.challenge_id, closesAt: row.closes_at,
          descriptionSource: row.description_source, representation: 'description-only' } };
      buildRequest(item);
      return item;
    });
  });
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate caption IDs');
  return { judgmentsStatus: 'proposed-not-human-reviewed', embeddingWeight: 0.5, items, comparisons: [] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node scripts/experiments/taste/import.mjs exported-rows.json dataset.json');
  const dataset = importChallenges(JSON.parse(readFileSync(input, 'utf8')));
  writeFileSync(output, JSON.stringify(dataset, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`Imported ${dataset.items.length} captions. Add comparison judgments before running evaluation.`);
}
