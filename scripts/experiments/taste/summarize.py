#!/usr/bin/env python3
"""Produce a compact, shareable JSON summary of a private taste evaluation.

Standard library only. Original results remain intact for --reuse. Summaries
still contain captions and model evidence; review them before sharing.
"""

import argparse
import json
import os
from pathlib import Path


def select(value, keys):
    return {key: value[key] for key in keys if key in value}


def comparison_key(row):
    return tuple(row.get(key) for key in ('anchor', 'positive', 'negative', 'category'))


def summarize(run):
    if (not isinstance(run, dict) or run.get('version') != 'taste-comparison-v1'
            or not isinstance(run.get('dataset'), dict)
            or not isinstance(run['dataset'].get('items'), list)
            or not isinstance(run.get('records'), list)):
        raise ValueError('Expected a complete taste-comparison-v1 result file, not a pasted snippet.')

    summary = select(run, ('version', 'status', 'createdAt', 'taxonomy', 'representation',
                           'models', 'embeddingWeight', 'plannedRequests', 'requestsMade'))
    summary['summaryVersion'] = 'taste-summary-v1'
    summary.setdefault('taxonomy', 'styles-v1')
    summary['judgmentsStatus'] = run['dataset'].get('judgmentsStatus')
    by_id = {}
    for record in run['records']:
        if record.get('kind') != 'labels':
            continue
        identifier = record['id']
        if identifier in by_id:
            raise ValueError(f'Duplicate label record for {identifier}')
        by_id[identifier] = record

    summary['items'] = []
    for item in run['dataset']['items']:
        compact = select(item, ('id', 'scene', 'caption'))
        record = by_id.get(item['id'])
        labels = record.get('result', {}).get('labels') if record else None
        compact['analysisStatus'] = 'available' if isinstance(labels, dict) else 'missing'
        if isinstance(labels, dict):
            compact['labels'] = select(labels, ('styles', 'topics', 'explanation'))
            for field in ('mechanisms', 'delivery'):
                if field in labels:
                    compact['labels'][field] = [select(entry, ('label', 'evidence', 'uncertainty'))
                                                 for entry in labels[field]]
            compact['labelsReused'] = record.get('reused', False)
        summary['items'].append(compact)

    evaluation = run.get('evaluation')
    summary['evaluation'] = None
    if isinstance(evaluation, dict):
        compact = select(evaluation, ('embeddingWeight', 'interpretation', 'labelScore'))
        for field in ('embeddings', 'styles', 'mechanisms', 'delivery', 'combined'):
            if field in evaluation:
                compact[field] = select(evaluation[field], ('total', 'wins', 'losses', 'ties', 'insufficient'))
        disagreements = {comparison_key(row) for row in evaluation.get('disagreements', [])}
        deliveries = {comparison_key(row): row.get('deliveryMargin') for row in evaluation.get('deliveryRows', [])}
        compact['rows'] = []
        for row in evaluation.get('rows', []):
            clean = select(row, ('anchor', 'positive', 'negative', 'category', 'embeddingMargin',
                                 'styleMargin', 'mechanismMargin', 'combinedMargin'))
            key = comparison_key(row)
            if key in deliveries:
                clean['deliveryMargin'] = deliveries[key]
            clean['representationDisagreement'] = key in disagreements
            compact['rows'].append(clean)
        summary['evaluation'] = compact
    summary['notes'] = [
        'Vectors, provider requests, fingerprints, raw usage and source identifiers omitted.',
        'Margins are unchanged; positive favors the reviewed positive example, negative favors the negative.',
        'Disagreement marks differing embedding versus label outcomes, not an execution error.',
        'Missing analysis/evaluation is not a zero score. Keep the original file for result reuse.',
        'Scene is retained for reference even in caption-only runs; check representation to see model input mode.',
    ]
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='Full result JSON (complete or partial run)')
    parser.add_argument('-o', '--output', type=Path, help='Defaults to INPUT.summary.json; must not exist')
    args = parser.parse_args()
    output = args.output or args.input.with_name(args.input.stem + '.summary.json')
    try:
        if output.resolve() == args.input.resolve():
            raise ValueError('Output must differ from the original result file.')
        result = summarize(json.loads(args.input.read_text(encoding='utf-8')))
        serialized = json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n'
        descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as target:
            target.write(serialized)
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        parser.exit(1, f'Cannot summarize: {error}\n')
    print(f'Wrote {output} ({len(result["items"])} items). Original preserved.')


if __name__ == '__main__':
    main()
