import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import { getImages } from "@/lib/images";
import type { Challenge } from "@/lib/challenges/types";
import ChallengeForm from "../../new/challenge-form";
export const maxDuration = 120;

export default async function EditChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { user, supabase } = await requireUser(`/challenges/${id}/edit`);
  const { data: row, error } = await supabase.from("challenges").select("*").eq("id", id).eq("creator_id", user.id).single();
  if (error || !row || row.hidden_at || row.status === "published") notFound();
  if (row.status === "generating") return <><SiteHeader /><main className="page-shell account-page"><h1>Generation is running</h1><p>Wait for generation to finish before editing this challenge.</p><Link href={`/challenges/${id}`}>Return to preview</Link></main></>;
  const { data: detail, error: readError } = await supabase.rpc("read_caption_challenge", { p_challenge: id });
  const human = (detail as Challenge | null)?.captions.find(c => c.origin === "human");
  if (readError || !human) notFound();
  const templates = await getImages();
  return <><SiteHeader /><main className="page-shell account-page">
    <Link href={`/challenges/${id}`}>← Challenge preview</Link><h1>Edit challenge</h1>
    <p className="account-intro">Changing the image, description, or joke context removes the current AI opponent. Caption-only edits keep it. Your changes must pass safety checks before publication.</p>
    <ChallengeForm userId={user.id} templates={templates} editing={{ id, revision: row.revision, initial: {
      source: row.template_id ? "template" : "upload", template: row.template_id ?? "", imageId: row.image_id ?? "",
      submission: "", description: row.image_description || row.situation, suggestion: "",
      manual: row.description_source === "replaced" || row.description_source === "manual",
      confirmed: true, imageReady: Boolean(row.image_id), needsFile: Boolean(row.image_path && !row.image_id),
      context: row.image_description ? row.joke_context ?? "" : "", caption: human.body,
    } }} />
  </main></>;
}
