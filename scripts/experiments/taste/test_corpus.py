import unittest
from corpus import prepare, make_batches


def sample():
    items = [{'id': str(i), 'scene': f'Scene {i}', 'caption': f'Caption {i}'} for i in range(18)]
    comparisons = [{'id': f'c{i}', 'anchor': str(i * 3), 'a': str(i * 3 + 1), 'b': str(i * 3 + 2)} for i in range(6)]
    return {'items': items, 'candidateComparisons': comparisons}


class CorpusTests(unittest.TestCase):
    def test_split_and_display_order_are_reproducible_and_disjoint(self):
        one = prepare(sample(), seed=12, held_out=2, context_ids=['c0'])
        self.assertEqual(one, prepare(sample(), seed=12, held_out=2, context_ids=['c0']))
        self.assertEqual(sum(c['split'] == 'held-out' for c in one['comparisons']), 2)
        self.assertEqual(one['comparisons'][0]['split'], 'context-control')
        self.assertEqual({c['id'] for c in one['comparisons']}, {f'c{i}' for i in range(6)})

    def test_requires_completed_review_and_preserves_ties_and_unclear(self):
        workspace = prepare(sample(), seed=1, held_out=0, context_ids=[])
        with self.assertRaises(ValueError):
            make_batches(workspace, 'development')
        for c in workspace['comparisons']:
            c['judgment'] = 'a'
        workspace['comparisons'][0]['judgment'] = 'tie'
        workspace['comparisons'][1]['judgment'] = 'unclear'
        batches, report = make_batches(workspace, 'development')
        self.assertEqual(len(batches), 1)
        self.assertEqual(len(batches[0]['items']), 12)
        self.assertEqual(len(report['excluded']), 2)
        self.assertEqual(batches[0]['judgmentsStatus'], 'human-reviewed')

    def test_choice_uses_displayed_order_and_batch_cap_is_enforced(self):
        workspace = prepare(sample(), seed=9, held_out=0, context_ids=[])
        for c in workspace['comparisons']:
            c['judgment'] = 'b'
        batches, _ = make_batches(workspace, 'development')
        self.assertEqual([len(batch['items']) for batch in batches], [12, 6])
        first = workspace['comparisons'][0]
        self.assertEqual(batches[0]['comparisons'][0]['positive'], first['b'])
        self.assertEqual(batches[0]['comparisons'][0]['negative'], first['a'])

    def test_rejects_bad_references_and_cross_split_duplicates(self):
        raw = sample()
        raw['candidateComparisons'][0]['a'] = 'missing'
        with self.assertRaises(ValueError):
            prepare(raw, seed=1, held_out=1, context_ids=[])
        raw = sample()
        raw['items'][3]['caption'] = raw['items'][0]['caption']
        with self.assertRaises(ValueError):
            prepare(raw, seed=1, held_out=1, context_ids=[])

    def test_context_control_cannot_enter_general_batches(self):
        workspace = prepare(sample(), seed=1, held_out=1, context_ids=['c0'])
        for c in workspace['comparisons']:
            c['judgment'] = 'a'
        batches, _ = make_batches(workspace, 'development')
        self.assertNotIn('0', [i['id'] for b in batches for i in b['items']])
        context, _ = make_batches(workspace, 'context-control')
        self.assertEqual(len(context), 1)
        self.assertEqual(context[0]['comparisons'][0]['category'], 'context-control')

    def test_modified_text_cannot_inherit_existing_judgments(self):
        workspace = prepare(sample(), seed=1, held_out=0, context_ids=[])
        for c in workspace['comparisons']:
            c['judgment'] = 'a'
        workspace['items'][0]['caption'] = 'Edited after review'
        with self.assertRaisesRegex(ValueError, 'Frozen corpus'):
            make_batches(workspace, 'development')


if __name__ == '__main__':
    unittest.main()
