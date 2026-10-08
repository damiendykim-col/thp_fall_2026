import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ChallengeWinner = {
  challenge_id: string; caption_id: string; caption: string; origin: "human" | "ai";
  upvotes: number; closes_at: string; situation: string;
  image_path: string | null; template_url: string | null; imageUrl: string | null;
};

export async function getChallengeWinners(supabase: SupabaseClient): Promise<ChallengeWinner[]> {
  const { data, error } = await supabase.rpc("list_challenge_winners");
  if (error) throw new Error("Winners could not be loaded.");
  const winners = (data ?? []) as Omit<ChallengeWinner,"imageUrl">[];
  const paths = [...new Set(winners.flatMap(w => w.image_path ? [w.image_path] : []))];
  const signed = new Map<string,string>();
  if (paths.length) {
    // Use the viewer's session and existing Storage policy, never an admin/public URL.
    const { data: urls } = await supabase.storage.from("challenge-images").createSignedUrls(paths,3600);
    for (const item of urls ?? []) {
      if (item.path && item.signedUrl && !item.error) signed.set(item.path,item.signedUrl);
    }
  }
  return winners.map(w => ({...w,imageUrl:w.image_path ? signed.get(w.image_path) ?? null : w.template_url}));
}
