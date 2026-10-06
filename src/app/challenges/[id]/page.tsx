import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import type { Challenge } from "@/lib/challenges/types";
import ChallengePanel from "./panel";
export const maxDuration = 60;
export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data, error } = await supabase.rpc("read_caption_challenge", { p_challenge: id });
  if (error) throw new Error("Unable to load challenge.");
  if (!data) notFound();
  const challenge = data as Challenge;
  let image = challenge.template_url;
  if (challenge.image_path) {
    const { data: signed } = await supabase.storage.from("challenge-images").createSignedUrl(challenge.image_path,3600);
    image = signed?.signedUrl ?? null;
  }
  return <><SiteHeader /><main className="page-shell account-page"><Link href="/challenges">← Challenges</Link><h1>{challenge.status === "published" ? "Caption challenge" : "Your challenge draft"}</h1><p className="account-intro">{challenge.situation}</p>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {image ? <img className="challenge-image" src={image} alt={challenge.situation} /> : <p>Image unavailable. Refresh to try again.</p>}
    <ChallengePanel challenge={challenge} />
  </main></>;
}
