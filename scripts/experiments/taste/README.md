# Taste representation pilot

Stage 2A foundation only. No production schema, model routing, user analysis or
paid calls were changed. The initial runner embeds **scene text plus caption**;
it is explicitly not a pixel-level multimodal evaluation. The proposed six-item
fixture is synthetic and its two comparison judgments need human review. It is a
smoke sample, not a quality benchmark or sufficient evidence for rollout.

## Model roles (checked October 10, 2026)

- Existing caption generation explicitly defaults to `gemini-3.5-flash-lite` in
  app code; AI Studio's UI default does not control the application.
- Reuse Flash-Lite as the first candidate for structured humor labels later.
  Generation, labeling and evaluation must have independent configuration and
  prompt versions when integrated; this pilot does not change app configuration.
- Pilot embedding candidate: `gemini-embedding-2`, a dedicated embedding endpoint.
  Flash-Lite generates text; do not ask it to invent comparable vector coordinates.
- First quality reference: human-reviewed comparisons, blind to origin/model.
  Another model family can be a secondary judge after a budget is agreed. It is
  not ground truth, and agreement between Google models is not independent evidence.

Google lists standard free-tier access for Flash-Lite and Embedding 2. Actual
project access/quota/billing have not been checked. Paid standard embedding rates
are $0.20 per million text tokens and $0.45 per million image tokens at review time.
No promise of a zero-cost call on a billing-enabled project. Free-tier data may be
used to improve Google products; use synthetic/non-sensitive pilot data.

Sources: [embeddings](https://ai.google.dev/gemini-api/docs/embeddings),
[pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Run

```sh
node --test scripts/experiments/taste/*.test.mjs
node scripts/experiments/taste/run.mjs scripts/experiments/taste/pilot.json
```

Default plan mode makes no requests, reads no env files, and needs no credentials.
Before any live run, review the proposed judgments, set `judgmentsStatus` to
`human-reviewed`, and confirm account quota/billing. Supply GEMINI_API_KEY securely
through your process environment; do not paste it into chat or commit it.

```sh
node scripts/experiments/taste/run.mjs reviewed-dataset.json --live /tmp/taste-run.json
```

Live mode is bounded to 12 items, one request each, no retries and a 30-second
per-request timeout. The checked-in pilot would use six requests. It refuses to
overwrite an output file and saves completed records on failure. Re-running starts
a new experiment and can incur new usage; automatic cache/resume is not implemented.
Outputs include inputs, fingerprints, model, representation version, dimensions,
latency, provider usage when available and pairwise cosine margins. Keep run outputs
private. Do not combine vectors from different models or representation versions.

## Interpretation and next gates

Each comparison asks whether the anchor is closer in humor style to the positive
than the negative. Labels are hypotheses until human-reviewed. Exact ties are
reported separately. No automatic pass threshold is set from two comparisons.
Before choosing a production representation, expand the sample to actual authorized
images, cross-topic style controls, temporal controls and GIF timing failures;
compare structured style-only labels and combined representations on held-out
judgments. The current fixture does not cover all those conditions.

Embedding 2 currently accepts at most six JPEG/PNG images per request. Our caption
storyboard can have eight frames. Do not silently truncate it or average unrelated
spaces. Evaluate an explicitly versioned six-frame/contact-sheet/other supported
representation, with human confirmation as appropriate, before multimodal runs.
The request builder rejects more than six images; the CLI currently refuses image
fields entirely so this text baseline cannot be mistaken for full media analysis.

Human fixture review and a secure execution environment are the next prerequisites.
No actual embeddings or semantic quality scores have been produced yet.
