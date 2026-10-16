import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import type { Challenge } from "@/lib/challenges/types";
import SafetyControls from "./safety-controls";
import CancelDraft from "./cancel-draft";
import WorkStatus from "@/components/work-status";
import RoundNavigation from "./round-navigation";
import ChallengePanel from "./panel";
export const maxDuration = 120;
export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser(`/challenges/${id}`);
  const { data, error } = await supabase.rpc("read_caption_challenge", { p_challenge: id });
  if (error) throw new Error("Unable to load challenge.");
  if (!data) notFound();
  const challenge = data as Challenge;
  let animationReview: string | null = null;
  if (challenge.own && challenge.image_path?.endsWith(".gif")) {
    const { data: review } = await supabase.from("challenge_images").select("animation_review").eq("storage_path",challenge.image_path).single();
    animationReview = review?.animation_review ?? "pending";
  }
  // Browse a bounded set through the viewer's RLS client; never read caption
  // origins or totals here. Existing ballots remain reachable.
  let previous: string | undefined;
  let next: string | undefined;
  if (challenge.status === "published" && !challenge.closed && !challenge.hidden_at) {
    const { data: rounds } = await supabase.from("challenges").select("id").eq("status", "published")
      .is("hidden_at", null).gt("closes_at", new Date().toISOString())
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
    const position = (rounds ?? []).findIndex(round => round.id === id);
    if (position >= 0) { previous = rounds?.[position - 1]?.id; next = rounds?.[position + 1]?.id; }
  }
  let image = challenge.template_url;
  if (challenge.image_path) {
    const { data: signed } = await supabase.storage.from("challenge-images").createSignedUrl(challenge.image_path,3600);
    image = signed?.signedUrl ?? null;
  }
  return <><SiteHeader /><main className="page-shell matchup-page"><Link href="/challenges">← Challenges</Link><h1>{challenge.status === "published" ? "Caption challenge" : "Your challenge draft"}</h1>{challenge.joke_context && <p className="account-intro">{challenge.joke_context}</p>}
    <div className="matchup-card"><div className="matchup-media">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {image ? <img className="challenge-image" src={image} alt={challenge.image_description || challenge.situation} /> : <p>Image unavailable. Refresh to try again.</p>}
    </div><div className="matchup-body">
    {challenge.hidden_at ? <p role="status">{challenge.status !== "published" ? "This draft was cancelled." : "This challenge is hidden from other members. Voting and publication are disabled."}</p> : <>
      {animationReview && animationReview !== "approved" && <WorkStatus waiting label={animationReview === "rejected" ? "GIF review rejected" : "Waiting for moderator review"}>
        <p>{animationReview === "rejected" ? "Choose another image using Edit challenge, or cancel this draft." : "You can generate the opponent now. Publication waits for full GIF approval."}</p>
      </WorkStatus>}
      <ChallengePanel challenge={challenge} publicationBlocked={animationReview !== null && animationReview !== "approved"} />
      {challenge.own && challenge.status !== "published" && <CancelDraft id={id} />}
      {challenge.status === "published" && <SafetyControls id={id} own={challenge.own} />}
    </>}
    </div></div><RoundNavigation previous={previous} next={next} />
  </main></>;
}
