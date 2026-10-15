# Private taste evaluation

## Current status — October 15, 2026

The private tooling slice and live development evaluations through v3 are complete.
The initial pilot, expanded v2 corpus, context control, adjudication and v3 run are
research evidence, not a production model-selection result. Production persistence,
taste summaries and downstream features await TA/professor feedback; see the
[current plan](../../../docs/design/README.md). No further run is required now.

Commands below are reproducibility recipes. Private `.runtime` files are not shipped
with a checkout; existing workspaces may already contain completed reviews/results.
Do not reset judgments, overwrite outputs or rerun live jobs just because an older
recipe names them. Use new output directories for new configurations.

Runner defaults differ intentionally: single-file `run.mjs` defaults to `styles-v1`;
`batch.py`/`batch.mjs` defaults to `mechanisms-v2`. V3 is explicit for either.
Neither default changes the production caption model.

## V3 reproducibility recipe (candidate prepared October 11)

`--taxonomy mechanisms-v3` opts into revised evidence guidance. The batch default remains
v2, with byte-identical requests and compatible existing batch ledgers. V3 retains
the same labels, schema, models, and scoring; only its prompt changes. It checks
for overlapping mechanisms, distinguishes downplaying from exaggeration, and
requires evidence before asserting sarcasm or wordplay. Empty/uncertain labels
remain valid. Tests verify routing, cache invalidation and abstention, not that an
LLM will follow the guidance correctly.

The original held-out results and approved post-result adjudication remain separate
in `.runtime`. They are development evidence now, not fresh validation. Do not
relabel or rescore them as untouched held-out results.

Four new assistant-authored triples (12 items) are in `corpus-v3.json`. Their review
workspace is `.runtime/v3-review.json`, prepared with seed 20261011 and no held-out
split. No intended answers are stored. These are hypothesis-informed development
examples from the same assistant that revised the prompt, not an independent
benchmark. Review before viewing generated labels. A later independent corpus is
still needed before making generalization claims.

On a fresh checkout, create the private workspace first (skip this if it already
exists; preparation refuses to overwrite saved judgments):

```sh
mkdir -p scripts/experiments/taste/.runtime
python3 scripts/experiments/taste/corpus.py prepare scripts/experiments/taste/corpus-v3.json scripts/experiments/taste/.runtime/v3-review.json --held-out 0 --seed 20261011
```

Then, from the repository root:

```sh
python3 scripts/experiments/taste/corpus.py review scripts/experiments/taste/.runtime/v3-review.json
python3 scripts/experiments/taste/corpus.py build scripts/experiments/taste/.runtime/v3-review.json scripts/experiments/taste/.runtime/v3-batches

export TASTE_LABEL_MODEL=gemini-3.5-flash-lite
export TASTE_EMBEDDING_MODEL=gemini-embedding-2
python3 scripts/experiments/taste/batch.py scripts/experiments/taste/.runtime/v3-batches scripts/experiments/taste/.runtime/v3-results --taxonomy mechanisms-v3 --max-requests 56
# After inspecting the plan, in the terminal with GEMINI_API_KEY exported:
python3 scripts/experiments/taste/batch.py scripts/experiments/taste/.runtime/v3-batches scripts/experiments/taste/.runtime/v3-results --taxonomy mechanisms-v3 --max-requests 56 --live
```

At most 48 fresh requests for both input conditions, with eight additional attempts
reserved for retries. Ties/unclear reduce coverage and requests. If all judgments
are tie/unclear, the build produces only a review report; skip the batch runner.
Keep models/prompt/scoring fixed after reviewing outputs. `.runtime/v3-freeze.json`
records the candidate hashes and corpus fingerprint. Preparation made no live requests; the subsequent v3 evaluation has completed.
The local `v3-results/batch-results.json` reports `status: complete`. V3-only results cannot establish an improvement
over v2; that requires both prompts on the same new reviewed comparisons.

## Larger corpus: offline review and batching

`corpus.py` uses Python's standard library. It never reads author notes or calls a
provider. For the Claude corpus supplied October 10, preparation has already made
`.runtime/claude-review.json`: 11 development triples, four held-out triples, and
`comparison-005` isolated as one context control. Judgments were initially unset; review and subsequent runs have since completed.
Check the existing workspace rather than preparing over it. The original Downloads
files were not changed by preparation.

Start the development review from the repo root:

```sh
python3 scripts/experiments/taste/corpus.py review scripts/experiments/taste/.runtime/claude-review.json
```

Judge similarity of how the joke works, considering the scene, rather than personal
preference or which is funniest. Choose `a`, `b`, `tie`, or `unclear`. `q` exits;
rerunning resumes at the first unanswered comparison. Every completed answer is
saved. A/B display order was shuffled once during preparation and remains fixed.
Author reasoning and intended answers are never displayed. Prior exposure to author
notes is still a review limitation; this does not manufacture independent judgments.

Once the development review is complete:

```sh
python3 scripts/experiments/taste/corpus.py build scripts/experiments/taste/.runtime/claude-review.json scripts/experiments/taste/.runtime/claude-development
```

This writes up to three runnable batch JSON files, each with at most four intact
triples / 12 items / 24 fresh requests per input condition. `review-report.json`
lists excluded ties/unclear cases and the overall worst-case request count. All-tie
splits produce a report and no runnable batches. Do not count excluded cases as
successful classifications or report the remaining accuracy without coverage.

Review/build the context control separately using `--split context-control` and a
different output directory. Its identical captions and shared scene are intentional:
keep its results separate from independent-caption comparisons. Do not force an
A/B judgment if neither is appropriate. Held-out review/export requires the explicit
`--split held-out` option; keep those results unopened until prompts/scoring are
frozen. Human judgments can be collected before any model runs.

The prepared workspace records a fixed seed and content/split fingerprint. Changes
to text or assignments invalidate it rather than silently inheriting old judgments.
Exact repeated text across triples is rejected during preparation; semantic near-
duplicates still require human inspection. New corpus preparation, if needed:

```sh
python3 scripts/experiments/taste/corpus.py prepare /path/to/corpus.json /path/to/new-review.json --held-out 4 --context-control comparison-005
```

Output files/directories must be new. Review workspaces and batch datasets stay in
the ignored `.runtime` folder. No real judgments, corpus content, or author notes
are committed by these tools.

**Batch size is not rate limiting.** Use the paced batch runner below for corpus
execution. The single-file Node runner retains its original no-retry behavior.
Authoring/splitting/review requires no API quota.

This is Stage 2A evaluation tooling, not a deployed taste-profile feature. It analyzes
**scene descriptions plus captions**, not image pixels or GIF motion. No production
schema or model routing changes are required. The user completed the first v1 live
pilot; its reported two comparisons favored same-topic embeddings (0/2 agreement),
with style labels at one win/one tie and combined scores at one win/one loss.
These are exploratory observations, not validation. Later v2/v3 runs do not make
that original two-comparison pilot a representative benchmark.

## What is wired

- Dedicated embedding requests and independently configured structured humor labels.
- Three comparisons: embedding cosine similarity, style-only similarity, and a
  weighted combination. Topic labels are retained for inspection but excluded from
  the style score. Empty styles mean insufficient evidence, not agreement.
- Private JSON results containing inputs, prompts, model IDs, versions, fingerprints,
  vectors, labels, explanations, usage when provided, latency and disagreements.
- Exact input/model/prompt-version result reuse, partial-failure checkpoints and
  explicit retries through a new single-file run. The batch runner adds bounded
  automatic transient-error retries and resumable ledgers; neither runs in production.
- Read-only selected-challenge export and a sanitizing importer. No ballots,
  profile data, author identities or Human/AI labels go into model requests.

## Model roles

The app explicitly defaults caption generation to `gemini-3.5-flash-lite`; AI
Studio's UI default does not control that setting. The pilot separately defaults to:

- `TASTE_LABEL_MODEL=gemini-3.5-flash-lite`
- `TASTE_EMBEDDING_MODEL=gemini-embedding-2`

Set these environment variables to evaluate another compatible Gemini endpoint.
They do not change the deployed generation model. Cross-provider judging is deferred;
human-reviewed comparisons remain the reference. The provisional taxonomy in
`labels.mjs` is an experiment, not an adopted production taxonomy. Labels describe
content, not the author or audience. Explanations are model hypotheses, not facts.

The October 10 investigation recorded free-tier availability, not a guarantee of
current account access, quota or billing. Verify provider pricing and account
settings before a new live run. A request cap is not a money cap. Confirm applicable
data handling and use only content approved for it; this guide does not authorize
sending private production content to a provider.

Sources: [embeddings](https://ai.google.dev/gemini-api/docs/embeddings),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Run the synthetic pilot

```sh
npm run test:taste
npm run taste:plan -- scripts/experiments/taste/pilot.json
```

Plan mode makes no requests, reads no env files, and needs no credentials. The
six-item pilot plans **12 requests**: one embedding and one label request per item.
The hard limit is 12 items / 24 requests, with 30 seconds per request and bounded
inputs/output tokens. Identical input requests within a run are reused too.

The two proposed comparisons are a smoke sample, not a sufficient quality benchmark.
Review whether each `positive` is actually closer in humor style to the `anchor`
than the `negative`. Change ambiguous examples or omit them; do not turn model
opinions into human ground truth. Set `judgmentsStatus` to `human-reviewed` only
after reviewing. Choose `embeddingWeight` (default 0.5) before inspecting results.

Keep reviewed datasets and outputs in the Git-ignored `.runtime` folder:

```sh
mkdir -p scripts/experiments/taste/.runtime
# Copy/review pilot.json as .runtime/reviewed_v1.json before the following commands.
node scripts/experiments/taste/run.mjs scripts/experiments/taste/.runtime/reviewed_v1.json --plan
node scripts/experiments/taste/run.mjs scripts/experiments/taste/.runtime/reviewed_v1.json --live scripts/experiments/taste/.runtime/run-1_v1.json
```

Supply `GEMINI_API_KEY` securely through the process environment. Never paste it
into chat or commit it. This runner does not load `.env.local` or pull Vercel secrets.
Live execution requires human-reviewed judgments and a new output path; output
files use owner-only permissions. No key is needed if every operation is reused.

To resume a failed run or reuse completed results, supply its output explicitly:

```sh
node scripts/experiments/taste/run.mjs scripts/experiments/taste/.runtime/reviewed_v1.json --plan --reuse scripts/experiments/taste/.runtime/run-1_v1.json
node scripts/experiments/taste/run.mjs scripts/experiments/taste/.runtime/reviewed_v1.json --live scripts/experiments/taste/.runtime/run-2.json --reuse scripts/experiments/taste/.runtime/run-1_v1.json
```

The plan reports missing requests before execution. Changed inputs/model/prompt
versions invalidate corresponding results. Failed or interrupted requests without
a completed checkpoint may be billed again on retry. Previous JSON must remain
private and trusted; fingerprints detect mismatches, not malicious file edits.
Outputs from the earlier embedding-only runner cannot be reused by this version.

## Selected real challenges

1. Choose up to six closed, visible challenges whose content may be used for this
   evaluation. Populate the explicit UUID array in `export.sql`; empty selects none.
2. Execute it through Supabase MCP/SQL Editor as an operator. It is read-only and
   excludes open/hidden challenges. Save the returned row array as private JSON.
3. Import it locally:

   ```sh
   node scripts/experiments/taste/import.mjs scripts/experiments/taste/.runtime/export.json scripts/experiments/taste/.runtime/real.json
   ```

4. Add cross-item `comparisons` with `anchor`, `positive`, `negative` item IDs and an
   optional `category`. Review them, then use the same plan/live workflow above.

The importer intentionally creates no judgments. Two captions from one challenge
provide useful contrast but cannot alone establish a three-item style comparison.
It preserves caption/challenge IDs as private provenance, strips extra fields,
validates closure and text bounds, and makes no network requests. Import only
consented content; SQL eligibility is not permission to send it to a provider.

## Reading results and deciding what follows

Create a compact JSON report with the standard-library Python script:

```sh
python3 scripts/experiments/taste/summarize.py scripts/experiments/taste/.runtime/mechanisms-scene-v2.json
```

It writes `mechanisms-scene-v2.summary.json` beside the input. Substitute your actual
result filename; use `-o another-summary.json` for a different destination. It never
overwrites a file. The report keeps captions, scenes, labels/evidence/uncertainty,
run configuration and scores. Vectors, requests, fingerprints and raw usage are
omitted. Disagreement flags and delivery margins are merged into comparison rows
instead of repeating them. Partial runs explicitly show missing analysis. Styles-v1 and mechanisms-v2/v3 are supported, including older runs without a taxonomy
field. Input must be the full result JSON, not a pasted fragment.

Keep the original for `--reuse`; the summary cannot replace it. Summaries still
contain your content, so review them before sharing. No credentials or network are
used. Test with `python3 -B -m unittest discover -s scripts/experiments/taste -p 'test_*.py'`.

The `evaluation` object reports wins/losses/ties/insufficient evidence for each
representation, per-comparison margins, categories and disagreements. Style-only
similarity is cosine over fixed binary style labels. Combined similarity is the
weighted sum of the two similarities, not a concatenation of incompatible vectors.
A 0.5 weight is an experimental baseline, not calibrated evidence of equal value.
Provider latency and usage remain attached to each record; `reused` distinguishes
historical API timings from calls made in the current run. Dollar cost is not
inferred from missing usage or an unverified billing tier.

Before selecting a production representation, expand coverage to same-image
contrasts, same-topic/different-style and different-topic/same-style examples,
topical/evergreen controls, held-out human judgments, and GIF timing failures.
Set quality criteria on that larger sample before looking at scores. Two pilot
comparisons cannot justify a pass threshold or a confident taste profile.

Embedding 2 accepts at most six JPEG/PNG images per request; our GIF storyboard may
contain eight. This CLI rejects image/frame inputs. A versioned, reviewed multimodal
representation remains a separate evaluation step; never silently discard frames.

Next gate: instructor feedback on the target use case and taxonomy, then an agreed
independent evaluation if needed. Existing reviewed runs are complete. Production persistence (2B),
closed-ballot taste summaries (2C), member graph, personalization and cross-family
judges remain deferred. The first private tooling slice is complete; Stage 2A's
empirical model selection is not.

## Second experiment: mechanisms and scene ablation

The default `styles-v1` taxonomy and original `pilot.json` remain unchanged to
preserve the baseline. Select `--taxonomy mechanisms-v2` for separate mechanisms,
delivery and topic. Each mechanism/delivery label requires textual evidence and a
`supported`/`uncertain` assessment. Only supported mechanisms enter the combined
score. Delivery is reported separately; topic is excluded. Evidence is model-written
and still needs human inspection; structural validation cannot prove it is true.

Use the same reviewed comparisons and models in both runs, changing only
`--representation`. `description-only` means scene text plus caption; `caption-only`
omits scene text from both embedding and labeling requests. Neither sees pixels.
Scores and cache keys track the input/prompt version. A scene-text change leaves
caption-only requests unchanged. Models may still bring learned background knowledge.

For the existing six-item reviewed dataset, plan the v2 label experiment while
reusing the first run's six embeddings:

```sh
node scripts/experiments/taste/run.mjs scripts/experiments/taste/.runtime/reviewed_v1.json --plan --taxonomy mechanisms-v2 --reuse scripts/experiments/taste/.runtime/run-1_v1.json
node scripts/experiments/taste/run.mjs scripts/experiments/taste/.runtime/reviewed_v1.json --live scripts/experiments/taste/.runtime/mechanisms-scene.json --taxonomy mechanisms-v2 --reuse scripts/experiments/taste/.runtime/run-1_v1.json
node scripts/experiments/taste/run.mjs scripts/experiments/taste/.runtime/reviewed_v1.json --plan --taxonomy mechanisms-v2 --representation caption-only
node scripts/experiments/taste/run.mjs scripts/experiments/taste/.runtime/reviewed_v1.json --live scripts/experiments/taste/.runtime/mechanisms-caption.json --taxonomy mechanisms-v2 --representation caption-only
```

With matching original defaults, this is six new label requests plus twelve
caption-only requests: 18 total across two runs. Check the plans before execution.
Do not change the weight based on these outcomes; compare row margins and inspect
evidence when scores disagree. This is a development experiment, not held-out testing.

`reviewed.json` adds three examples without the original shared custody wording and
three proposed comparisons (nine items, five comparisons). Copy it to a private
reviewed dataset and review ALL judgments before setting `human-reviewed`—new
examples do not inherit prior approval. A fresh run plans 18 requests, so two input
conditions cost up to 36 requests total, though each run remains capped at 24.
Do not compare runs on different datasets as if the input representation were the
only difference. Original item names such as `finals-absurd` are hypotheses and
never included in provider prompts. A larger independent held-out set remains needed.


## Paced corpus execution

`batch.py` is a Python entry point that launches `batch.mjs` using your project's
Node runtime. It reuses the tested evaluator; there is no second implementation of
prompts or scoring. No external Python packages are required.

Plan both input conditions for the reviewed development batches (no network):

```sh
python3 scripts/experiments/taste/batch.py scripts/experiments/taste/.runtime/claude-development scripts/experiments/taste/.runtime/claude-development-results
```

For the current six directional comparisons, the plan is 72 fresh requests:
36 label calls and 36 embedding calls. The default total budget is 80 attempts,
including failures/retries, leaving eight attempts of headroom. This is a request
budget, not a monetary cap. Run in the terminal with `GEMINI_API_KEY` exported:

```sh
python3 scripts/experiments/taste/batch.py scripts/experiments/taste/.runtime/claude-development scripts/experiments/taste/.runtime/claude-development-results --live
```

Run the SAME command to resume after an ordinary failure. Completed operations
are reused across the job; completed batches are skipped. Outputs include each
condition/batch's full JSON (compatible with `summarize.py`) and `batch-results.json`
with combined counts, per-comparison margins, and the review coverage report.
The excluded three ties and two unclear judgments remain visible in that report.
All outputs are private files in the ignored runtime folder.

Pacing defaults based on the supplied quota screenshot, with headroom:

- Labels: 10 requests/minute; 200,000 reserved tokens/minute; 200 attempts per job.
- Embeddings: 60 requests/minute; 24,000 reserved tokens/minute; 500 attempts per job.
- Serial execution, with separate per-role spacing and rolling 60-second windows.
- Token reservations use UTF-8 request-body bytes plus maximum output tokens.
  This is a conservative estimate, not the provider's tokenizer or an exact TPM
  guarantee. Actual quotas can also be consumed by the deployed app or other jobs.
- HTTP 429/500/502/503/504: at most two retries per operation, with 60/120-second
  backoff and longer Retry-After respected up to five minutes. Longer cooldowns
  stop the job. Network timeouts and invalid/authentication responses are not retried.
- Every attempt is saved before sending, so an interruption cannot erase its usage.
  A request that finished remotely but lacked a saved result may incur usage again.

`--condition caption-only` or `--condition description-only` runs just that condition.
`--max-requests N` sets the whole-job attempt budget; it must cover the missing work.
`--limits path.json` accepts an object with `labels` and `embedding` entries, each
containing positive integer `rpm`, `tpm`, and `allowance` values. Set job allowances
below your known remaining project quota. None of these budgets resets on resume
or at midnight. This runner cannot read or enforce project-wide remaining quotas.

Keep input files, model environment overrides, conditions and budget settings
unchanged when resuming; the job fingerprint rejects configuration drift. Different
experiments use new output directories and separate budgets, so do not run them
concurrently against the same shared API quota. Completed-job reruns make no calls.
The job ledger counts actual HTTP attempts; individual result files count logical
operations and therefore do not include additional retry attempts.

A directory lock prevents two writers to one job. After a forced termination, a
`.lock` can remain: it contains the process ID. Confirm that process has stopped
before manually deleting only that lock, then resume with the original command.
Do not delete `job.json` or result files to bypass a spent budget.
