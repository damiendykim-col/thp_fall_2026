import { MODEL, VERSION, buildRequest, cosine, embed, evaluate, fingerprint } from './evaluate.mjs';
import { LABEL_MODEL, LABEL_VERSION, buildLabelRequest, label, validateLabels } from './labels.mjs';
import { MECHANISM_VERSION, buildMechanismRequest, validateMechanisms } from './mechanisms.mjs';

export const RUN_VERSION = 'taste-comparison-v1';

function validateResult(kind, result, taxonomy = 'styles-v1') {
  if (kind === 'embedding') {
    cosine(result?.vector, result?.vector);
    if (result.dimensions !== result.vector.length) throw new Error('Invalid vector dimensions');
  } else (taxonomy === 'mechanisms-v2' ? validateMechanisms : validateLabels)(result?.labels);
}

export function planRun(dataset, { previous, labelModel = LABEL_MODEL, embeddingModel = MODEL, embeddingWeight = 0.5,
  taxonomy = 'styles-v1', representation = 'description-only' } = {}) {
  if (!['styles-v1', 'mechanisms-v2'].includes(taxonomy) || !['caption-only', 'description-only'].includes(representation)) throw new Error('Unknown taxonomy or representation');
  if (!Number.isFinite(embeddingWeight) || embeddingWeight < 0 || embeddingWeight > 1) throw new Error('Embedding weight must be between zero and one');
  for (const model of [labelModel, embeddingModel]) {
    if (typeof model !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid model identifier');
  }
  if (!Array.isArray(dataset.items) || !dataset.items.length || dataset.items.length > 12 ||
      dataset.items.some(item => !item || typeof item.id !== 'string' || !item.id.trim()) ||
      new Set(dataset.items.map(item => item.id)).size !== dataset.items.length) throw new Error('Require 1–12 uniquely identified items');
  if (dataset.items.some(item => item.images || item.frames || item.imagePath)) throw new Error('This runner is a description-only baseline; pixel/GIF inputs need separate evaluation');
  evaluate(Object.fromEntries(dataset.items.map(item => [item.id, [1, 0]])), dataset.comparisons);
  const operations = dataset.items.flatMap(item => {
    const request = buildRequest(item);
    request.model = `models/${embeddingModel}`;
    if (representation === 'caption-only') request.content.parts[0].text = `Caption: ${item.caption}`;
    const labelRequest = taxonomy === 'mechanisms-v2' ? buildMechanismRequest(item, representation) : buildLabelRequest(item);
    if (representation === 'caption-only' && taxonomy === 'styles-v1') {
      labelRequest.contents[0].parts[0].text = `Caption: ${item.caption}`;
      labelRequest.systemInstruction.parts[0].text += ' No scene description is supplied; do not infer a scene.';
    }
    return [
      { id: item.id, kind: 'embedding', version: representation === 'caption-only' ? 'taste-caption-only-v1' : VERSION, model: embeddingModel, request },
      { id: item.id, kind: 'labels', version: taxonomy === 'mechanisms-v2' ? MECHANISM_VERSION : LABEL_VERSION, model: labelModel, request: labelRequest },
    ].map(operation => ({ ...operation, fingerprint: fingerprint({ kind: operation.kind, version: operation.version, model: operation.model, request: operation.request }) }));
  });
  if (previous && (previous.version !== RUN_VERSION || !Array.isArray(previous.records))) throw new Error('Incompatible previous run; use a comparison-v1 output');
  const cache = new Map();
  for (const record of previous?.records ?? []) {
    const expected = fingerprint({ kind: record.kind, version: record.version, model: record.model, request: record.request });
    if (expected !== record.fingerprint) throw new Error('Previous run fingerprint mismatch');
    if (operations.some(operation => operation.fingerprint === record.fingerprint)) {
      validateResult(record.kind, record.result, taxonomy);
      cache.set(record.fingerprint, record.result);
    }
  }
  const missing = new Set(operations.filter(operation => !cache.has(operation.fingerprint)).map(operation => operation.fingerprint));
  return { operations, cache, requests: missing.size, labelModel, embeddingModel, embeddingWeight, taxonomy, representation };
}

function styleSimilarity(a, b) {
  if (!a.length || !b.length) return null;
  return a.filter(style => b.includes(style)).length / Math.sqrt(a.length * b.length);
}

export function compareRepresentations(dataset, results, embeddingWeight) {
  const rows = dataset.comparisons.map(({ anchor, positive, negative, category = 'unspecified' }) => {
    const a = results[anchor], p = results[positive], n = results[negative];
    const embeddingMargin = cosine(a.vector, p.vector) - cosine(a.vector, n.vector);
    const sp = styleSimilarity(a.labels.styles, p.labels.styles), sn = styleSimilarity(a.labels.styles, n.labels.styles);
    const styleMargin = sp === null || sn === null ? null : sp - sn;
    return { anchor, positive, negative, category, embeddingMargin, styleMargin,
      combinedMargin: styleMargin === null ? null : embeddingWeight * embeddingMargin + (1 - embeddingWeight) * styleMargin };
  });
  const outcome = margin => margin === null ? 'insufficient' : Math.abs(margin) < 1e-9 ? 'tie' : margin > 0 ? 'win' : 'loss';
  const summarize = field => {
    const outcomes = rows.map(row => outcome(row[field]));
    return { total: rows.length, wins: outcomes.filter(x => x === 'win').length,
      losses: outcomes.filter(x => x === 'loss').length, ties: outcomes.filter(x => x === 'tie').length,
      insufficient: outcomes.filter(x => x === 'insufficient').length };
  };
  return { embeddingWeight, embeddings: summarize('embeddingMargin'), styles: summarize('styleMargin'),
    combined: summarize('combinedMargin'), rows,
    disagreements: rows.filter(row => row.styleMargin !== null && outcome(row.embeddingMargin) !== outcome(row.styleMargin)),
    interpretation: 'Exploratory agreement with reviewed comparisons; not proof of taste accuracy or a rollout threshold.' };
}

export async function executeRun(dataset, options = {}) {
  const plan = planRun(dataset, options);
  if (dataset.judgmentsStatus !== 'human-reviewed') throw new Error('Review comparison judgments before live evaluation');
  const checkpoint = options.checkpoint ?? (() => {});
  const providers = options.providers ?? {
    embedding: request => embed(request, options.key),
    labels: request => label(request, options.key, plan.labelModel, undefined, plan.taxonomy === 'mechanisms-v2' ? validateMechanisms : validateLabels),
  };
  const run = { version: RUN_VERSION, representation: plan.representation, taxonomy: plan.taxonomy, createdAt: new Date().toISOString(),
    models: { embedding: plan.embeddingModel, labels: plan.labelModel }, embeddingWeight: plan.embeddingWeight,
    dataset, plannedRequests: plan.requests, requestsMade: 0, records: [], status: 'running' };
  await checkpoint(run);
  try {
    for (const operation of plan.operations) {
      const reused = plan.cache.has(operation.fingerprint);
      let result = plan.cache.get(operation.fingerprint);
      if (!reused) {
        run.requestsMade++;
        result = await providers[operation.kind](operation.request);
        validateResult(operation.kind, result, plan.taxonomy);
        plan.cache.set(operation.fingerprint, result);
      }
      run.records.push({ ...operation, result, reused });
      await checkpoint(run);
    }
    const results = Object.fromEntries(dataset.items.map(item => [item.id, {}]));
    for (const record of run.records) Object.assign(results[record.id], record.result);
    const dimensions = new Set(Object.values(results).map(result => result.vector.length));
    if (dimensions.size !== 1) throw new Error('Incompatible vector dimensions across the run');
    if (plan.taxonomy === 'mechanisms-v2') {
      const project = field => Object.fromEntries(Object.entries(results).map(([id, result]) => [id, {
        ...result, labels: { styles: result.labels[field].filter(entry => entry.uncertainty === 'supported').map(entry => entry.label) },
      }]));
      const mechanismReport = compareRepresentations(dataset, project('mechanisms'), plan.embeddingWeight);
      const deliveryReport = compareRepresentations(dataset, project('delivery'), plan.embeddingWeight);
      const { styles, rows, disagreements, ...rest } = mechanismReport;
      const renameMargin = ({ styleMargin, ...row }) => ({ ...row, mechanismMargin: styleMargin });
      run.evaluation = { ...rest, mechanisms: styles, delivery: deliveryReport.styles,
        rows: rows.map(renameMargin), disagreements: disagreements.map(renameMargin),
        deliveryRows: deliveryReport.rows.map(row => ({ anchor: row.anchor, positive: row.positive,
          negative: row.negative, category: row.category, deliveryMargin: row.styleMargin })),
        labelScore: 'supported mechanisms only; delivery and topics excluded from combined score' };
    } else run.evaluation = compareRepresentations(dataset, results, plan.embeddingWeight);
    run.status = 'complete';
  } catch (error) {
    run.status = 'failed';
    throw error;
  } finally { await checkpoint(run); }
  return run;
}
