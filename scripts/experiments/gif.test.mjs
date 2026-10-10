import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { prepareGif, chooseFrames, LIMITS } from './gif.mjs';

async function fixture(delays = [100, 200, 300], width = 48) {
  const colors = ['red', 'green', 'blue'];
  const frames = await Promise.all(delays.map((_, i) => sharp({ create: { width, height: 32, channels: 4, background: colors[i % 3] } }).png().toBuffer()));
  return (frames.length === 1 ? sharp(frames[0]) : sharp(frames, { join: { animated: true } })).gif({ delay: delays, loop: 0 }).toBuffer();
}

test('keeps animation timing and produces distinct, chronological JPEG samples', async () => {
  const result = await prepareGif(await fixture());
  const meta = await sharp(result.animation, { animated: true }).metadata();
  assert.equal(meta.pages, 3);
  assert.deepEqual(meta.delay, [100, 200, 300]);
  assert.equal(meta.loop, 0);
  assert.deepEqual(result.samples.map(s => s.index), [0, 1, 2]);
  assert.deepEqual(result.samples.map(s => s.startMs), [0, 100, 300]);
  for (const sample of result.samples) assert.equal((await sharp(sample.jpeg).metadata()).format, 'jpeg');
  const { data } = await sharp(result.samples[2].jpeg).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[2] > data[0] + 100, 'last sample is the blue frame, not a repeated first frame');
});
test('time-based sampling includes endpoints, handles variable delays and caps samples', () => {
  const selected = chooseFrames([1000, 10, 10, 10, 10, 10, 10, 1000, 10, 10], 4);
  assert.deepEqual(selected, [0, 7, 9]);
  assert.ok(chooseFrames(Array(100).fill(100), 8).length <= 8);
});
test('rejects invalid, non-GIF, oversized and excessive-frame inputs', async () => {
  await assert.rejects(prepareGif(Buffer.from('GIF89a bad file')));
  await assert.rejects(prepareGif(await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).png().toBuffer()), /GIF/);
  await assert.rejects(prepareGif(Buffer.alloc(LIMITS.inputBytes + 1)), /size/);
  await assert.rejects(prepareGif(await fixture(Array(121).fill(100))), /frames/);
});
test('rejects excessive duration and total decoded pixels before full decoding', async () => {
  await assert.rejects(prepareGif(await fixture([11000, 11000, 11000])), /duration/);
  await assert.rejects(prepareGif(await fixture(Array(100).fill(100), 16000)), /pixel/);
});
test('single-frame GIF is valid and has one sample', async () => {
  const result = await prepareGif(await fixture([100]));
  assert.equal(result.samples.length, 1);
});

test('sampling can miss a brief intermediate frame; it is not a moderation guarantee', () => {
  const selected = chooseFrames(Array(120).fill(100));
  assert.equal(selected.includes(1), false);
  assert.equal(selected[0], 0);
  assert.equal(selected.at(-1), 119);
});
