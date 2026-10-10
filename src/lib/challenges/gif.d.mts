export const LIMITS: Readonly<{ inputBytes: number; outputBytes: number; frames: number; durationMs: number; decodedPixels: number; dimension: number; samples: number; seconds: number }>;
export function chooseFrames(delays: number[], count?: number): number[];
export function prepareGif(bytes: Buffer, options?: { thumbnails?: boolean; selectedFrames?: number[] }): Promise<{
  animation: Buffer;
  samples: { index: number; startMs: number; durationMs: number; jpeg: Buffer }[];
  previews: { index: number; startMs: number; durationMs: number; jpeg: Buffer }[];
  frames: number; durationMs: number; elapsedMs: number; representation: string;
}>;
