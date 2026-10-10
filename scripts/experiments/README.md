# GIF feasibility experiment

This directory supports an isolated local prototype and the development-only
`/experiments/gif` storyboard. The core processor now lives in `src/lib/challenges/gif.mjs` and is shared with
the integrated challenge flow; see `docs/gif-challenges.md` for rollout. The
command-line experiment uses no credentials, network calls, storage writes,
or paid model calls. The local storyboard requires a local test sign-in and
checks the existing development-only auth gate on both its page and server action.

Run from the repository root:

```sh
node --test scripts/experiments/gif.test.mjs
node scripts/experiments/gif-benchmark.mjs
```

`prepareGif` decodes all frames using Sharp, preserves animation for display,
resizes to at most 640 pixels per side, strips source metadata by re-encoding,
and extracts up to eight chronological JPEG samples. Sampling is based on elapsed
frame time and includes the first and last frames. Each sample includes its frame
index, start time, and duration for a future multimodal prompt. Tiny/zero delays
are normalized to 100ms; browser playback can differ for these inputs.

Experimental bounds (not app configuration): 3 MiB input/output, 120 frames,
30 seconds, 40 million total decoded pixels, and a 15-second processing budget
using Sharp timeouts. This is not a process-isolated hard wall-clock or memory
limit. The decoded RGBA buffer alone can reach 160 MB; concurrent requests would
need their own resource controls. Output size is checked after encoding.

Tests exercise chronology, actual sampled pixel content, delay/loop preservation,
single-frame GIFs, invalid/oversized files, frame/pixel/duration limits, and the
fact that a short intermediate frame can be missed by sampling. Further testing
must cover real meme GIFs, disposal/transparency edge cases, malformed/truncated
animations, near-limit noisy images, and concurrent processing. Synthetic fixtures
are not representative of compression complexity or production performance.

## Original integration considerations (now implemented in the challenge flow)

- Keep an animated display asset and a versioned AI representation. Gemini's image
  input documentation does not list GIF; send ordered JPEG samples with timestamps,
  not GIF bytes labeled as JPEG. Reuse the same representation for description and
  caption generation. Record that representation and prompt version.
- Current reservation SQL assigns `.jpg` paths and the bucket allows JPEG only.
  Storage schema/configuration and MIME handling need migration together.
- Caption sampling is not a full-animation safety check. Before enabling uploads,
  choose a separate all-frame review strategy or moderator approval for animations.
  Even an all-frame model assessment is probabilistic. Do not silently mark a whole
  GIF approved because its sampled frames passed.
- The active still-image upload now uses a 3 MiB upload limit and a 4 MiB server-action
  body limit, leaving room under Vercel's 4.5 MB request cap. Larger uploads require
  direct-to-private-staging storage plus server validation, finalization, and cleanup.
  Avatar limits remain separate.
- Add this disclosure only when GIF uploads are enabled:
  “The AI sees sampled frames from this GIF. It may miss quick actions, timing,
  or brief text. Review its description and add context if needed.”
- Validate real description/caption quality against several GIFs before claiming
  motion understanding. This experiment makes no claims about Gemini output quality
  or free-tier cost; it does not call Gemini. Eight images can consume more tokens
  even when sent in a single request.

References checked October 9, 2026:
- [Gemini image inputs](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Sharp animation input](https://sharp.pixelplumbing.com/api-constructor/)
- [Sharp output and timeouts](https://sharp.pixelplumbing.com/api-output/)
- [Vercel request limits](https://vercel.com/docs/errors/function_payload_too_large)

## Human review trial

With `npm run e2e:dev` running, sign in to a local test account and open
`http://127.0.0.1:3100/experiments/gif`. Select a GIF and accept the automatic storyboard immediately with “Use these
frames.” This confirms only the local preview. Clicking a thumbnail moves the
scrubber and preview to that frame. Open “Adjust frames” to browse to a missed
moment and use “Replace selected frame.” Changes remain chronological and require
confirmation again. Reset restores the automatic selection. Choices remain on the page only; neither
images nor selections are saved or sent to Gemini. The route returns not-found in
production, and the server action independently rejects production execution.

The preview response contains bounded, small JPEGs for all frames so that browsing
does not trigger repeated server calls. Preview JPEGs total at most 1 MiB before
base64 encoding. This extends the same processing deadline used by the CLI.

Time-based selection remains the baseline, not a claim of optimal sampling.
Compare it against scene-change/keyframe selection on real GIFs before introducing
another heuristic. Prefer optional human correction over mandatory frame picking.
Creator-selected context must never be the sole basis for moderation approval.

A separate alternative is converting GIF to a supported video format and using
Gemini video input. This moves frame sampling into the provider, adds transcoding,
and still does not guarantee that brief events are seen. Evaluate quality/cost
before replacing the explicit storyboard approach.
See [Gemini video input](https://ai.google.dev/gemini-api/docs/video-understanding).
