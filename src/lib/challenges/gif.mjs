// Bounded animation processing. Frame selection is context, never publication approval.
import sharp from 'sharp';

export const LIMITS = Object.freeze({ inputBytes: 3 * 1024 * 1024, outputBytes: 3 * 1024 * 1024, frames: 120, durationMs: 30000, decodedPixels: 40_000_000, dimension: 640, samples: 8, seconds: 15 });

export function chooseFrames(delays, count = LIMITS.samples) {
  if (!delays.length || count < 2 || delays.some(d => !Number.isFinite(d) || d <= 0)) throw new Error('Invalid sampling input');
  if (delays.length <= count) return delays.map((_, i) => i);
  const duration = delays.reduce((a, b) => a + b, 0);
  const selected = new Set([0, delays.length - 1]);
  for (let n = 1; n < count - 1; n++) {
    const target = duration * n / (count - 1);
    let elapsed = 0;
    for (let i = 0; i < delays.length; i++) {
      elapsed += delays[i];
      if (elapsed > target) { selected.add(i); break; }
    }
  }
  return [...selected].sort((a, b) => a - b);
}

export async function prepareGif(bytes, { thumbnails = false, selectedFrames } = {}) {
  if (!bytes.length || bytes.length > LIMITS.inputBytes) throw new Error('GIF file size exceeds prototype limit');
  const started = performance.now();
  const bounded = pipeline => {
    const seconds = Math.floor(LIMITS.seconds - (performance.now() - started) / 1000);
    if (seconds < 1) throw new Error('GIF processing deadline exceeded');
    return pipeline.timeout({ seconds });
  };
  const options = { animated: true, limitInputPixels: LIMITS.decodedPixels, failOn: 'warning' };
  const meta = await bounded(sharp(bytes, options)).metadata();
  if (meta.format !== 'gif') throw new Error('Expected GIF content');
  const frames = meta.pages ?? 1;
  const height = meta.pageHeight ?? meta.height;
  if (frames > LIMITS.frames) throw new Error('Too many GIF frames');
  if (!meta.width || !height || meta.width * height * frames > LIMITS.decodedPixels) throw new Error('Too many decoded pixels');
  // Tiny/zero delays have browser-dependent playback. Use a documented 100ms fallback.
  const delays = Array.from({ length: frames }, (_, i) => (meta.delay?.[i] ?? 0) <= 10 ? 100 : meta.delay[i]);
  const durationMs = delays.reduce((sum, delay) => sum + delay, 0);
  if (durationMs > LIMITS.durationMs) throw new Error('GIF duration exceeds prototype limit');
  // Decode all composited frames, including disposal/transparency, before sampling.
  const { data, info } = await bounded(sharp(bytes, options).resize(LIMITS.dimension, LIMITS.dimension, { fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw()).toBuffer({ resolveWithObject: true });
  const pageHeight = info.height / frames;
  if (!Number.isInteger(pageHeight)) throw new Error('Unexpected GIF frame layout');
  const animation = await bounded(sharp(data, { raw: { width: info.width, height: info.height, channels: 4, pageHeight } }).gif({ delay: delays, loop: meta.loop ?? 1, effort: 3, keepDuplicateFrames: true })).toBuffer();
  if (animation.length > LIMITS.outputBytes) throw new Error('Re-encoded GIF file size exceeds prototype limit');
  const samples = [];
  const frameBytes = info.width * pageHeight * 4;
  const selected = selectedFrames ?? chooseFrames(delays);
  if (!Array.isArray(selected) || !selected.length || selected.length > LIMITS.samples || new Set(selected).size !== selected.length || selected.some(i => !Number.isInteger(i) || i < 0 || i >= frames)) throw new Error('Invalid frame selection');
  for (const index of [...selected].sort((a,b) => a-b)) {
    const frame = data.subarray(index * frameBytes, (index + 1) * frameBytes);
    const jpeg = await bounded(sharp(frame, { raw: { width: info.width, height: pageHeight, channels: 4 } }).flatten({ background: '#151515' }).jpeg({ quality: 80 })).toBuffer();
    samples.push({ index, startMs: delays.slice(0, index).reduce((a, b) => a + b, 0), durationMs: delays[index], jpeg });
  }
  const previews = [];
  let previewBytes = 0;
  if (thumbnails) {
    let startMs = 0;
    for (let index = 0; index < frames; index++) {
      const jpeg = await bounded(sharp(data.subarray(index * frameBytes, (index + 1) * frameBytes), { raw: { width: info.width, height: pageHeight, channels: 4 } })
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#151515' }).jpeg({ quality: 60 })).toBuffer();
      previewBytes += jpeg.length;
      if (previewBytes > 1024 * 1024) throw new Error('Storyboard previews exceed prototype size limit');
      previews.push({ index, startMs, durationMs: delays[index], jpeg });
      startMs += delays[index];
    }
  }
  return { animation, samples, previews, frames, durationMs, elapsedMs: performance.now() - started, representation: 'gif-time-samples-v1' };
}
