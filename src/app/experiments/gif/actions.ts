"use server";
import { isTestAuthEnabled } from "@/lib/test-auth-config";
import { requireUser } from "@/lib/auth";
import { prepareGif } from "../../../../scripts/experiments/gif.mjs";

export type Storyboard = { frames: { index: number; startMs: number; durationMs: number; src: string }[]; selected: number[]; durationMs: number };
export async function inspectGif(form: FormData): Promise<{ storyboard?: Storyboard; error?: string }> {
  if (!isTestAuthEnabled()) return { error: "This experiment is available only in local development." };
  await requireUser();
  const file = form.get("image");
  if (!(file instanceof File) || file.size > 3 * 1024 * 1024 || !file.size) return { error: "Choose a GIF up to 3 MB." };
  try {
    const result = await prepareGif(Buffer.from(await file.arrayBuffer()), { thumbnails: true });
    return { storyboard: { durationMs: result.durationMs, selected: result.samples.map(s => s.index), frames: result.previews.map(frame => ({ index: frame.index, startMs: frame.startMs, durationMs: frame.durationMs, src: `data:image/jpeg;base64,${frame.jpeg.toString("base64")}` })) } };
  } catch { return { error: "This GIF could not be processed. Limits: 3 MB, 120 frames, 30 seconds, and 40 million total decoded pixels. Try a smaller animation." }; }
}
