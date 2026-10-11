import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from summarize import summarize


def fixture():
    return {
        'version': 'taste-comparison-v1', 'status': 'complete',
        'taxonomy': 'mechanisms-v2', 'representation': 'description-only',
        'models': {'embedding': 'embedding-model', 'labels': 'label-model'},
        'dataset': {'judgmentsStatus': 'human-reviewed', 'items': [
            {'id': 'a', 'scene': 'A desk', 'caption': 'My deadline moved in.', 'source': {'private': True}},
        ]},
        'records': [
            {'id': 'a', 'kind': 'embedding', 'request': {'secret': 'omit'},
             'result': {'vector': [1, 0], 'dimensions': 2}},
            {'id': 'a', 'kind': 'labels', 'reused': True, 'result': {'labels': {
                'mechanisms': [{'label': 'personification', 'evidence': 'deadline moved in', 'uncertainty': 'supported'}],
                'delivery': [], 'topics': ['work'], 'explanation': 'Personifies a deadline.',
            }}},
        ],
        'evaluation': {'mechanisms': {'total': 1, 'wins': 1}, 'rows': [
            {'anchor': 'a', 'positive': 'b', 'negative': 'c', 'mechanismMargin': 0.5},
        ], 'disagreements': [{'anchor': 'a', 'positive': 'b', 'negative': 'c'}],
            'deliveryRows': [{'anchor': 'a', 'positive': 'b', 'negative': 'c', 'deliveryMargin': 0}]},
    }


class SummaryTests(unittest.TestCase):
    def test_keeps_evidence_and_merges_comparison_details_without_bulk_data(self):
        result = summarize(fixture())
        self.assertEqual(result['items'][0]['labels']['mechanisms'][0]['evidence'], 'deadline moved in')
        self.assertEqual(result['evaluation']['rows'][0]['deliveryMargin'], 0)
        self.assertTrue(result['evaluation']['rows'][0]['representationDisagreement'])
        self.assertNotIn('"vector":', json.dumps(result))
        self.assertNotIn('"request":', json.dumps(result))
        self.assertNotIn('private', json.dumps(result))

    def test_v1_without_taxonomy_and_partial_results(self):
        raw = fixture()
        raw.pop('taxonomy')
        raw['records'][1]['result']['labels'] = {'styles': ['ironic'], 'topics': [], 'explanation': 'Test'}
        self.assertEqual(summarize(raw)['taxonomy'], 'styles-v1')
        raw['status'] = 'failed'
        raw.pop('evaluation')
        raw['records'] = []
        result = summarize(raw)
        self.assertIsNone(result['evaluation'])
        self.assertEqual(result['items'][0]['analysisStatus'], 'missing')

    def test_rejects_snippets_and_duplicate_label_records(self):
        with self.assertRaises(ValueError):
            summarize({'labels': {}})
        raw = fixture()
        raw['records'].append(raw['records'][1])
        with self.assertRaises(ValueError):
            summarize(raw)

    def test_cli_preserves_original_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'run.json'
            original = json.dumps(fixture())
            source.write_text(original)
            command = [sys.executable, str(Path(__file__).with_name('summarize.py')), str(source)]
            first = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            output = source.with_name('run.summary.json')
            self.assertTrue(output.exists())
            self.assertEqual(source.read_text(), original)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
            self.assertNotEqual(subprocess.run(command + ['-o', str(source)], capture_output=True).returncode, 0)


if __name__ == '__main__':
    unittest.main()
