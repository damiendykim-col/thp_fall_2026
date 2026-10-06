import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { requireUser } from "@/lib/auth";
export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { supabase, user } = await requireUser();
  const { view } = await searchParams;
  const selected = view === "yours" || view === "finished" ? view : "open";
  let query = supabase.from("challenges").select("id,situation,status,closes_at,created_at").order("created_at", { ascending: false }).limit(50);
  if (selected === "yours") query = query.eq("creator_id", user.id);
  else {
    query = query.eq("status", "published");
    query = selected === "finished" ? query.lte("closes_at", new Date().toISOString()) : query.gt("closes_at", new Date().toISOString());
  }
  const { data, error } = await query;
  return <><SiteHeader /><main className="page-shell account-page"><h1>Caption challenges</h1><p className="account-intro">Upvote your favorite. Find out who wrote it when time runs out.</p>
    <Link className="button" href="/challenges/new">Create challenge</Link>
    <nav className="challenge-tabs" aria-label="Challenge filters">{["open","finished","yours"].map(v => <Link key={v} href={`/challenges?view=${v}`} aria-current={selected===v ? "page" : undefined}>{v[0].toUpperCase()+v.slice(1)}</Link>)}</nav>
    {error ? <p role="alert">Challenges couldn’t be loaded. Please try again.</p> : !data?.length ? <p>No challenges here yet.</p> : <ul className="challenge-list">{data.map(c => <li key={c.id}><Link className="challenge-card" href={`/challenges/${c.id}`}><p>{c.situation}</p><span className="muted">{c.status === "published" ? "View challenge →" : `Your ${c.status} →`}</span></Link></li>)}</ul>}
    {(data?.length ?? 0)>=50 && <p className="muted">Showing the latest 50 challenges.</p>}
  </main></>;
}
