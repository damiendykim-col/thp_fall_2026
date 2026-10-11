import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { planRun, executeRun, RUN_VERSION } from './pipeline.mjs';
import { embed, MODEL } from './evaluate.mjs';
import { label, LABEL_MODEL } from './labels.mjs';
import { validateMechanisms } from './mechanisms.mjs';
import { createScheduler, LIMITS } from './scheduler.mjs';

function read(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function write(path, value) {
  writeFileSync(`${path}.partial`, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(`${path}.partial`, path);
}

export function prepareJob(datasets, { conditions = ['description-only', 'caption-only'], maxRequests = 80,
  embeddingModel = MODEL, labelModel = LABEL_MODEL, limits = LIMITS, taxonomy = 'mechanisms-v2' } = {}) {
  if (!['mechanisms-v2', 'mechanisms-v3'].includes(taxonomy)) throw new Error('Unknown batch taxonomy');
  if (!datasets.length || !conditions.length || new Set(conditions).size !== conditions.length ||
      conditions.some(c => !['description-only', 'caption-only'].includes(c))) throw new Error('Invalid batches/conditions');
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 1000) throw new Error('Request budget must be 1–1000');
  if (!limits.labels || !limits.embedding) throw new Error('Both model limits are required');
  createScheduler({ attempts: [] }, { limits, maxRequests }); // Validate before any output/network.
  const tasks = conditions.flatMap(representation => datasets.map((dataset, index) => {
    if (dataset.judgmentsStatus !== 'human-reviewed') throw new Error('All batches must be human-reviewed');
    const options = { representation, taxonomy, embeddingModel, labelModel, embeddingWeight: dataset.embeddingWeight ?? 0.5 };
    const plan = planRun(dataset, options);
    return { name: `${representation}-batch-${String(index + 1).padStart(2, '0')}`, dataset, options, plan };
  }));
  const operations = new Map(tasks.flatMap(task => task.plan.operations.map(operation => [operation.fingerprint, operation])));
  const requestsByRole = Object.fromEntries(['labels', 'embedding'].map(kind => [kind, [...operations.values()].filter(operation => operation.kind === kind).length]));
  const config = { version: 'taste-batch-v1', datasets, conditions, maxRequests, embeddingModel, labelModel, limits };
  // Preserve historical v2 job fingerprints for resumability.
  if (taxonomy !== 'mechanisms-v2') config.taxonomy = taxonomy;
  const fingerprint = createHash('sha256').update(JSON.stringify(config)).digest('hex');
  return { tasks, maxRequests, limits, fingerprint, requestsByRole, freshRequests: operations.size };
}

function cachedRecords(job, directory) {
  return job.tasks.flatMap(task => {
    const path = join(directory, `${task.name}.json`);
    return existsSync(path) ? read(path).records : [];
  });
}

export function inspectJob(job, directory) {
  const path = join(directory, 'job.json');
  const state = existsSync(path) ? read(path) : { fingerprint: job.fingerprint, attempts: [] };
  if (state.fingerprint !== job.fingerprint) throw new Error('Job inputs/configuration changed; use the original settings to resume');
  if (!Array.isArray(state.attempts)) throw new Error('Invalid job ledger');
  const records = cachedRecords(job, directory);
  const missing = new Set();
  for (const task of job.tasks) {
    const plan = planRun(task.dataset, { ...task.options, previous: { version: RUN_VERSION, records } });
    for (const operation of plan.operations) if (!plan.cache.has(operation.fingerprint)) missing.add(operation.fingerprint);
  }
  return { state, records, missingRequests: missing.size, remainingBudget: job.maxRequests - state.attempts.length };
}

export async function runJob(job, directory, { key, fetcher = fetch, timing = {}, log = console.error } = {}) {
  const inspection = inspectJob(job, directory);
  if (inspection.missingRequests > inspection.remainingBudget) throw new Error('Remaining request budget cannot cover missing work');
  if (inspection.missingRequests && !key) throw new Error('Export GEMINI_API_KEY in this terminal; no env files are loaded');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = join(directory, '.lock');
  writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
  let state = inspection.state;
  try {
    // Re-read after acquiring the lock; another process may have finished since planning.
    const current = inspectJob(job, directory);
    state = current.state;
    if (current.missingRequests > current.remainingBudget) throw new Error('Remaining request budget cannot cover missing work');
    // Refuse unrelated existing results without an accompanying ledger.
    if (!existsSync(join(directory, 'job.json')) && inspection.records.length) throw new Error('Cached outputs lack their job ledger');
    state.status = 'running';
    const checkpoint = () => write(join(directory, 'job.json'), state);
    checkpoint();
    const scheduler = createScheduler(state, { ...timing, limits: job.limits, maxRequests: job.maxRequests, checkpoint, log });
    let records = current.records;
    const completed = [];
    for (const task of job.tasks) {
      const path = join(directory, `${task.name}.json`);
      if (existsSync(path) && read(path).status === 'complete') {
        completed.push({ task, run: read(path) });
        log(`Reused completed ${task.name}`);
        continue;
      }
      log(`Running ${task.name}`);
      const run = await executeRun(task.dataset, { ...task.options, previous: { version: RUN_VERSION, records },
        providers: {
          embedding: request => embed(request, key, (url, options) => scheduler.fetch('embedding')(url, options, fetcher)),
          labels: request => label(request, key, task.options.labelModel,
            (url, options) => scheduler.fetch('labels')(url, options, fetcher), validateMechanisms),
        }, checkpoint: snapshot => write(path, snapshot),
      });
      records = [...records, ...run.records];
      completed.push({ task, run });
    }
    const report = { status: 'complete', attempts: state.attempts.length, maxRequests: job.maxRequests, conditions: {} };
    for (const { task, run } of completed) {
      const result = report.conditions[task.options.representation] ??= { scores: {}, rows: [], files: [] };
      result.files.push(`${task.name}.json`);
      for (const name of ['embeddings', 'mechanisms', 'delivery', 'combined']) {
        const counts = result.scores[name] ??= { total: 0, wins: 0, losses: 0, ties: 0, insufficient: 0 };
        for (const field of Object.keys(counts)) counts[field] += run.evaluation[name][field];
      }
      result.rows.push(...run.evaluation.rows.map(row => ({ ...row, batch: task.name })));
    }
    write(join(directory, 'batch-results.json'), report);
    state.status = 'complete';
    checkpoint();
    return report;
  } catch (error) {
    state.status = 'failed';
    write(join(directory, 'job.json'), state);
    throw error;
  } finally { unlinkSync(lock); }
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    live: { type: 'boolean' }, 'max-requests': { type: 'string', default: '80' },
    condition: { type: 'string', default: 'both' },
    limits: { type: 'string' }, taxonomy: { type: 'string', default: 'mechanisms-v2' },
  } });
  if (positionals.length !== 2) throw new Error('Usage: python3 batch.py BATCH_DIRECTORY OUTPUT_DIRECTORY [--live] [--condition both|description-only|caption-only] [--max-requests 80]');
  const [input, directory] = positionals.map(path => resolve(path));
  const paths = readdirSync(input).filter(name => /^batch-\d+\.json$/.test(name)).sort();
  const datasets = paths.map(path => read(join(input, path)));
  if (new Set(datasets.map(dataset => dataset.split)).size > 1) throw new Error('Do not mix splits in one job');
  const job = prepareJob(datasets, { conditions: values.condition === 'both' ? undefined : [values.condition],
    taxonomy: values.taxonomy, maxRequests: Number(values['max-requests']), embeddingModel: process.env.TASTE_EMBEDDING_MODEL,
    labelModel: process.env.TASTE_LABEL_MODEL, limits: values.limits ? read(values.limits) : undefined });
  const inspection = inspectJob(job, directory);
  console.log(JSON.stringify({ mode: values.live ? 'live' : 'plan', taxonomy: values.taxonomy, batches: datasets.length,
    freshRequests: job.freshRequests, requestsByRole: job.requestsByRole,
    missingRequests: inspection.missingRequests, remainingBudget: inspection.remainingBudget,
    limits: job.limits, conditions: job.tasks.map(task => task.options.representation).filter((c, i, a) => a.indexOf(c) === i) }, null, 2));
  if (values.live) {
    const result = await runJob(job, directory, { key: process.env.GEMINI_API_KEY });
    const review = join(input, 'review-report.json');
    if (existsSync(review)) {
      result.reviewCoverage = read(review);
      write(join(directory, 'batch-results.json'), result);
    }
    console.log(`Completed. Read ${join(directory, 'batch-results.json')}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
