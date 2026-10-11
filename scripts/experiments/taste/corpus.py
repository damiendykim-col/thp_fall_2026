#!/usr/bin/env python3
"""Prepare a frozen corpus, collect blind judgments, and export bounded batches.

Offline only. Does not read author notes, load credentials, or call providers.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import random

SPLITS = ('development', 'held-out', 'context-control')
CHOICES = ('a', 'b', 'tie', 'unclear')


def prepare(raw, *, seed, held_out, context_ids):
    items = raw.get('items', [])
    triples = raw.get('candidateComparisons', [])
    if not items or not triples:
        raise ValueError('Corpus must contain items and candidateComparisons.')
    cleaned = []
    for item in items:
        if not isinstance(item.get('id'), str) or not item['id'].strip():
            raise ValueError('Item IDs must be nonempty strings.')
        for field, limit in [('scene', 1000), ('caption', 280)]:
            if not isinstance(item.get(field), str) or not item[field].strip() or len(item[field]) > limit:
                raise ValueError(f'Invalid {field} for {item["id"]}')
        cleaned.append({k: item[k] for k in ('id', 'scene', 'caption')})
    by_id = {i['id']: i for i in cleaned}
    if len(by_id) != len(cleaned):
        raise ValueError('Duplicate item IDs.')
    seen, identifiers, comparisons = set(), set(), []
    text_groups = {}
    for triple in triples:
        identifier = triple.get('id')
        if not isinstance(identifier, str) or not identifier or identifier in identifiers:
            raise ValueError('Duplicate or missing comparison ID.')
        identifiers.add(identifier)
        refs = [triple.get(k) for k in ('anchor', 'a', 'b')]
        if len(set(refs)) != 3 or any(i not in by_id or i in seen for i in refs):
            raise ValueError('Each comparison must reference three distinct, previously unused items.')
        seen.update(refs)
        for ref in refs:
            for field in ('scene', 'caption'):
                text = ' '.join(by_id[ref][field].casefold().split())
                key = (field, text)
                if key in text_groups and text_groups[key] != identifier:
                    raise ValueError('Repeated scene/caption spans triples; group these manually before splitting.')
                text_groups[key] = identifier
        comparisons.append({k: triple[k] for k in ('id', 'anchor', 'a', 'b')})
    if seen != set(by_id):
        raise ValueError('Every item must belong to exactly one triple.')
    contexts = set(context_ids)
    if not contexts <= identifiers:
        raise ValueError('Unknown context-control comparison ID.')
    eligible = sorted(identifiers - contexts)
    if held_out < 0 or held_out >= len(eligible):
        raise ValueError('Held-out count must leave at least one development triple.')
    rng = random.Random(seed)
    held = set(rng.sample(eligible, held_out))
    for c in comparisons:
        c['split'] = 'context-control' if c['id'] in contexts else 'held-out' if c['id'] in held else 'development'
        if rng.randrange(2):
            c['a'], c['b'] = c['b'], c['a']
        c['judgment'] = None
    digest = hashlib.sha256(json.dumps({'items': cleaned, 'comparisons': comparisons}, sort_keys=True).encode()).hexdigest()
    return {'version': 'taste-review-v1', 'seed': seed, 'corpusFingerprint': digest,
            'question': 'Which alternative is closer to the anchor in how the joke works (humor mechanism), considering the scene? This is not a funniest-joke or personal-taste vote.',
            'items': cleaned, 'comparisons': comparisons}


def make_batches(workspace, split):
    validate_workspace(workspace)
    if workspace.get('version') != 'taste-review-v1' or split not in SPLITS:
        raise ValueError('Unsupported review workspace or split.')
    comparisons = [c for c in workspace['comparisons'] if c['split'] == split]
    if not comparisons or any(c.get('judgment') not in CHOICES for c in comparisons):
        raise ValueError('Finish every judgment in this split before exporting batches.')
    items = {i['id']: i for i in workspace['items']}
    eligible = [c for c in comparisons if c['judgment'] in ('a', 'b')]
    excluded = [{'id': c['id'], 'judgment': c['judgment']} for c in comparisons if c['judgment'] in ('tie', 'unclear')]
    batches = []
    for offset in range(0, len(eligible), 4):
        group = eligible[offset:offset + 4]
        refs = [c[k] for c in group for k in ('anchor', 'a', 'b')]
        batches.append({'judgmentsStatus': 'human-reviewed', 'embeddingWeight': 0.5,
                        'reviewFingerprint': workspace['corpusFingerprint'], 'split': split,
                        'items': [items[i] for i in refs],
                        'comparisons': [{'anchor': c['anchor'], 'positive': c[c['judgment']],
                                         'negative': c['b' if c['judgment'] == 'a' else 'a'],
                                         'category': split, 'reviewId': c['id']} for c in group]})
    report = {'split': split, 'reviewedComparisons': len(comparisons), 'scoredComparisons': len(eligible),
              'excluded': excluded, 'batchCount': len(batches),
              'maxRequestsOneConditionWithoutReuse': len(eligible) * 6,
              'note': 'Ties and unclear are preserved but excluded from the directional scorer. Do not report its agreement as coverage of all reviewed comparisons. Context controls must be reported separately.'}
    return batches, report


def validate_workspace(workspace):
    if workspace.get('version') != 'taste-review-v1':
        raise ValueError('Unsupported review workspace.')
    comparisons = [{**{k: c[k] for k in ('id', 'anchor', 'a', 'b', 'split')}, 'judgment': None}
                   for c in workspace['comparisons']]
    digest = hashlib.sha256(json.dumps({'items': workspace['items'], 'comparisons': comparisons}, sort_keys=True).encode()).hexdigest()
    if digest != workspace.get('corpusFingerprint'):
        raise ValueError('Frozen corpus or split changed. Prepare a new workspace and review it again.')


def save_new(path, value):
    text = json.dumps(value, indent=2, ensure_ascii=False) + '\n'
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as file:
        file.write(text)


def checkpoint(path, value):
    temporary = path.with_suffix('.pending.json')
    save_new(temporary, value)
    os.replace(temporary, path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    prep = commands.add_parser('prepare')
    prep.add_argument('corpus', type=Path)
    prep.add_argument('output', type=Path)
    prep.add_argument('--seed', type=int, default=20261010)
    prep.add_argument('--held-out', type=int, default=4)
    prep.add_argument('--context-control', action='append', default=[])
    for name in ('review', 'build'):
        sub = commands.add_parser(name)
        sub.add_argument('workspace', type=Path)
        sub.add_argument('--split', choices=SPLITS, default='development')
        if name == 'build':
            sub.add_argument('output_directory', type=Path)
    args = parser.parse_args()
    try:
        if args.command == 'prepare':
            workspace = prepare(json.loads(args.corpus.read_text()), seed=args.seed,
                                held_out=args.held_out, context_ids=args.context_control)
            save_new(args.output, workspace)
            print('Created review workspace. Split counts:', {s: sum(c['split'] == s for c in workspace['comparisons']) for s in SPLITS})
            return
        workspace = json.loads(args.workspace.read_text())
        validate_workspace(workspace)
        if args.command == 'review':
            by_id = {i['id']: i for i in workspace['items']}
            for c in workspace['comparisons']:
                if c['split'] != args.split or c.get('judgment') in CHOICES:
                    continue
                print('\n' + c['id'] + '\n' + workspace['question'])
                for name in ('anchor', 'a', 'b'):
                    item = by_id[c[name]]
                    print(f'\n{name.upper()}\nScene: {item["scene"]}\nCaption: {item["caption"]}')
                while True:
                    choice = input('\nChoose a / b / tie / unclear, or q to save and exit: ').strip().lower()
                    if choice == 'q':
                        return
                    if choice in CHOICES:
                        break
                    print('Please use one of the listed choices.')
                c['judgment'] = choice
                c['reviewedAt'] = datetime.now(timezone.utc).isoformat()
                checkpoint(args.workspace, workspace)
            print('Review complete for', args.split)
        else:
            batches, report = make_batches(workspace, args.split)
            args.output_directory.mkdir(mode=0o700)  # Refuse existing directory.
            for index, batch in enumerate(batches, 1):
                save_new(args.output_directory / f'batch-{index:02}.json', batch)
            save_new(args.output_directory / 'review-report.json', report)
            print(json.dumps(report, indent=2))
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f'Cannot process corpus: {error}\n')
    except (EOFError, KeyboardInterrupt):
        print('\nStopped. Previously completed judgments are saved.')


if __name__ == '__main__':
    main()
