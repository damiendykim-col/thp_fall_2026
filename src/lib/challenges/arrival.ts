import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Challenge } from "./types";

export type RecentRound = { id: string; closes_at: string; joke_context: string | null };
export type SavedDraft = { id: string; status: string };
export type ReturnData = { draft: SavedDraft | null; drafts?: SavedDraft[]; recent: RecentRound[]; error: boolean };
export type ResultRound = Challenge & { imageUrl: string | null };

// All queries use the viewer's client/RLS, never a service key or shared cache.
export async function getReturnVisits(client: SupabaseClient, userId: string): Promise<ReturnData> {
  const now = new Date().toISOString();
  const fields = "id,closes_at,joke_context";
  const [drafts, own, voted] = await Promise.all([
    client.from("challenges").select("id,status").eq("creator_id", userId).is("hidden_at", null)
      .is("published_at", null).in("status", ["draft", "ready", "failed", "generating"])
      .order("created_at", { ascending: false }).limit(3),
    client.from("challenges").select(fields).eq("creator_id", userId).eq("status", "published")
      .is("hidden_at", null).lte("closes_at", now).order("closes_at", { ascending: false }).limit(3),
    client.from("challenge_votes").select(`round:challenges!inner(${fields})`).eq("user_id", userId)
      .eq("round.status", "published").is("round.hidden_at", null).lte("round.closes_at", now)
      .order("round(closes_at)", { ascending: false }).limit(3),
  ]);
  const votedRounds = (voted.error ? [] : voted.data ?? []).flatMap(row => row.round) as unknown as RecentRound[];
  const recent = [...new Map([...(own.error ? [] : own.data ?? []), ...votedRounds].map(row => [row.id, row as RecentRound])).values()]
    .sort((a, b) => b.closes_at.localeCompare(a.closes_at)).slice(0, 3);
  return { drafts: drafts.error ? [] : drafts.data ?? [], draft: drafts.error ? null : drafts.data?.[0] ?? null, recent, error: Boolean(drafts.error || own.error || voted.error) };
}

export const RESULTS_PAGE_SIZE = 12;
export function resultsPage(value?: string): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 && n <= 10000 ? n : 1;
}

export async function getRoundResults(client: SupabaseClient, page: number) {
  const start = (page - 1) * RESULTS_PAGE_SIZE;
  const { data, error } = await client.from("challenges").select("id").eq("status", "published")
    .is("hidden_at", null).lte("closes_at", new Date().toISOString())
    .order("closes_at", { ascending: false }).order("id", { ascending: false }).range(start, start + RESULTS_PAGE_SIZE);
  if (error) throw new Error("Results couldn’t be loaded. Please refresh to try again.");
  // Reuse the existing disclosure boundary. It calculates closure with database time
  // and suppresses attribution/counts until then. Work is bounded to one page.
  const reads = await Promise.all((data ?? []).slice(0, RESULTS_PAGE_SIZE).map(row => client.rpc("read_caption_challenge", { p_challenge: row.id })));
  if (reads.some(read => read.error)) throw new Error("Results couldn’t be loaded. Please refresh to try again.");
  const rounds = reads.map(read => read.data as Challenge | null).filter((row): row is Challenge => Boolean(row?.closed && !row.hidden_at && row.status === "published"));
  const paths = [...new Set(rounds.flatMap(row => row.image_path ? [row.image_path] : []))];
  const signed = paths.length ? await client.storage.from("challenge-images").createSignedUrls(paths, 3600) : { data: [] };
  const urls = new Map((signed.data ?? []).flatMap(item => item.path && item.signedUrl && !item.error ? [[item.path, item.signedUrl]] : []));
  return { rounds: rounds.map(row => ({ ...row, imageUrl: row.image_path ? urls.get(row.image_path) ?? null : row.template_url })), more: (data?.length ?? 0) > RESULTS_PAGE_SIZE };
}
