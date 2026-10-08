import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import ModeratorControls from "./controls";
export default async function ModerationPage() {
  const { supabase } = await requireUser();
  const { data: allowed, error: roleError } = await supabase.rpc("is_moderator");
  if (roleError || !allowed) notFound();
  const [reports, templates] = await Promise.all([
    supabase.rpc("list_challenge_reports"), supabase.rpc("list_unreviewed_templates"),
  ]);
  if (reports.error || templates.error) throw new Error("Moderation queue could not be loaded.");
  return <><SiteHeader /><main className="page-shell account-page">
    <h1>Moderation</h1>
    <p>Dark humor and satire alone are not grounds for removal. Review threats, hate, targeted harassment, sexual exploitation, self-harm encouragement, and privacy violations.</p>
    <h2>Open reports</h2>
    <p className="muted">Showing the oldest 100 unresolved reports. Hiding removes a challenge from feeds, results, and future member reads; previously issued image links may remain usable until they expire.</p>
    {!reports.data?.length && <p>No open reports.</p>}
    <ul className="challenge-list">{reports.data?.map((report: { id: string; challenge_id: string; reason: string; situation: string }) => <li className="challenge-card" key={report.id}>
      <p>{report.situation}</p><p>Reason: {report.reason.replaceAll("_", " ")}</p>
      <Link href={`/challenges/${report.challenge_id}`}>Review challenge</Link>
      <ModeratorControls reportId={report.id} challengeId={report.challenge_id} />
    </li>)}</ul>
    <h2>Template reviews</h2>
    <p>Review the full image or animation before approving it for challenges. Text descriptions cannot establish image safety. This does not moderate or remove the public Templates gallery itself.</p>
    <ul className="challenge-list">{templates.data?.map((template: { id: string; image_url: string; description: string | null }) => <li className="challenge-card" key={template.id}>
      {/* Native images allow review of all animated frames. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="challenge-image" src={template.image_url} alt={template.description || "Template awaiting review"} />
      <p>{template.description || "No description"}</p><ModeratorControls templateId={template.id} />
    </li>)}</ul>
  </main></>;
}
