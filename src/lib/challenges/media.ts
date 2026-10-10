import "server-only";
import { prepareGif } from "./gif.mjs";
export const isGif = (bytes: Buffer) => /^GIF8[79]a$/.test(bytes.subarray(0,6).toString("ascii"));
export type MediaPart = { text: string; inlineData?: never } | { inlineData: { mimeType: string; data: string }; text?: never };
export async function imageParts(bytes: Buffer, selectedFrames?: number[]): Promise<MediaPart[]> {
  if (!isGif(bytes)) return [{ inlineData: { mimeType: "image/jpeg", data: bytes.toString("base64") } }];
  const gif = await prepareGif(bytes, { selectedFrames });
  return [{ text: "These are chronological sampled frames of one GIF, not separate images. Unsampled motion or text may be missing; do not invent unseen events." }, ...gif.samples.flatMap((frame): MediaPart[] => [
    { text: `Frame ${frame.index + 1}, ${(frame.startMs / 1000).toFixed(3)}s, displayed for ${frame.durationMs}ms.` },
    { inlineData: { mimeType: "image/jpeg", data: frame.jpeg.toString("base64") } },
  ])];
}
