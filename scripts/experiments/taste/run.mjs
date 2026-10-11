import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { planRun, executeRun } from './pipeline.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  live: { type: 'boolean' }, plan: { type: 'boolean' }, reuse: { type: 'string' },
  taxonomy: { type: 'string' }, representation: { type: 'string' },
} });
const [file, output] = positionals;
if (!file || positionals.length > 2 || (values.live && values.plan) || (!values.live && output)) {
  throw new Error('Usage: node scripts/experiments/taste/run.mjs dataset.json [--plan | --live output.json] [--reuse previous-run.json]');
}
const dataset = JSON.parse(readFileSync(file, 'utf8'));
const options = {
  previous: values.reuse ? JSON.parse(readFileSync(values.reuse, 'utf8')) : undefined,
  labelModel: process.env.TASTE_LABEL_MODEL,
  embeddingModel: process.env.TASTE_EMBEDDING_MODEL,
  embeddingWeight: dataset.embeddingWeight ?? 0.5,
  taxonomy: values.taxonomy,
  representation: values.representation,
};
const plan = planRun(dataset, options);
console.log(JSON.stringify({ models: { embedding: plan.embeddingModel, labels: plan.labelModel },
  representation: plan.representation, taxonomy: plan.taxonomy, requests: plan.requests, maxRequests: 24,
  reusedOperations: plan.operations.filter(operation => plan.cache.has(operation.fingerprint)).length,
  comparisons: dataset.comparisons.length, judgments: dataset.judgmentsStatus,
  embeddingWeight: plan.embeddingWeight, live: Boolean(values.live) }));

if (values.live) {
  if (dataset.judgmentsStatus !== 'human-reviewed') throw new Error('Review comparison judgments before live evaluation');
  if (!output) throw new Error('Provide a new output path');
  if (plan.requests && !process.env.GEMINI_API_KEY) throw new Error('Supply the key through the environment; .env files are not read');
  // Reserve the output before any API calls. Never overwrite a prior experiment.
  writeFileSync(output, '{}', { flag: 'wx', mode: 0o600 });
  await executeRun(dataset, { ...options, key: process.env.GEMINI_API_KEY, checkpoint: run => {
    // An interrupted write leaves the last complete checkpoint usable for --reuse.
    const temporary = `${output}.partial`;
    writeFileSync(temporary, JSON.stringify(run, null, 2), { mode: 0o600 });
    renameSync(temporary, output);
  } });
}
