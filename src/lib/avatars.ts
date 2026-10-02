import type { SupabaseClient } from "@supabase/supabase-js";
import { measureOperation } from "./performance";

// The caller's authenticated client enforces Storage RLS on every batch.
// Signed URLs remain request-local; there is no shared private-data cache.
export async function signAvatars(
  supabase: SupabaseClient,
  paths: (string | null)[],
  operation: "members.avatars" | "profile.avatars",
) {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const signed = new Map<string, string>();
  if (!unique.length) return signed;
  const { data, error } = await measureOperation(operation, () =>
    supabase.storage.from("avatars").createSignedUrls(unique, 3600));
  if (!error) {
    for (const item of data ?? []) {
      if (item.path && unique.includes(item.path) && !item.error && item.signedUrl) {
        signed.set(item.path, item.signedUrl);
      }
    }
  }
  if (signed.size !== unique.length) console.error("Avatar signing failed for one or more photos");
  return signed;
}
