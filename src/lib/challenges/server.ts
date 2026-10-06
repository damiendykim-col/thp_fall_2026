import "server-only";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export function challengeAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Challenge storage is not configured on this deployment yet.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function normalizeChallengeImage(file: File) {
  if (!file.size || file.size > 2 * 1024 * 1024) throw new Error("Choose a JPEG, PNG or WebP image up to 2 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("format");
    // Decode, apply orientation, resize, remove metadata, and save an immutable JPEG.
    return await image.rotate().resize(1600,1600,{fit:"inside",withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
  } catch { throw new Error("Choose a valid, still JPEG, PNG or WebP image (at most 40 megapixels)."); }
}
