// No provider calls or credentials. Synthetic fixtures only.
import sharp from 'sharp';
import { prepareGif } from './gif.mjs';

for (const [width, height, frames] of [[320, 240, 30], [640, 480, 60], [800, 600, 80]]) {
  const images = [];
  for (let i = 0; i < frames; i++) {
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#151515"/><circle cx="${20 + (width - 40) * i / (frames - 1)}" cy="${height / 2}" r="20" fill="#ffe01b"/></svg>`;
    images.push(await sharp(Buffer.from(svg)).png().toBuffer());
  }
  const gif = await sharp(images, { join: { animated: true } }).gif({ delay: Array(frames).fill(100), loop: 0 }).toBuffer();
  const result = await prepareGif(gif);
  console.log(JSON.stringify({ fixture: `${width}x${height}/${frames} frames`, inputBytes: gif.length, animationBytes: result.animation.length, sampleBytes: result.samples.reduce((n, s) => n + s.jpeg.length, 0), sampleIndices: result.samples.map(s => s.index), elapsedMs: Math.round(result.elapsedMs) }));
}
