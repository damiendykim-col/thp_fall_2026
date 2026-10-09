import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { createAuthClient } from "@/lib/supabase/server";
import { getChallengeWinners } from "@/lib/challenges/winners";
import Winners from "../images/winners";
import ChallengeDemo from "./demo";

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const supabase = await createAuthClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== 'AuthSessionMissingError') throw new Error('Unable to check your session. Please refresh.');
  const { view } = await searchParams;
  const selected = view === 'results' || view === 'finished' ? 'results' : view === 'yours' && user ? 'yours' : 'open';
  const tabs = [{ value: 'open', label: 'Open' }, { value: 'results', label: 'Results' }, ...(user ? [{ value: 'yours', label: 'Yours' }] : [])];
  let content;
  if (!user) content = <><ChallengeDemo /><p className="guest-note">Live challenges and results are currently shared with signed-in members. Sign in to take part.</p></>;
  else if (selected === 'results') {
    const winners = await getChallengeWinners(supabase).catch(() => null);
    content = winners ? <><Winners winners={winners} /><CompletedRounds /></> : <p role="alert">Results couldn’t be loaded. Please refresh to try again.</p>;
  } else {
    let query = supabase.from('challenges').select('id,situation,joke_context,image_description,image_path,template_url,status,closes_at,hidden_at').order('created_at', { ascending: false }).limit(50);
    query = selected === 'yours' ? query.eq('creator_id', user.id) : query.eq('status', 'published').is('hidden_at', null).gt('closes_at', new Date().toISOString());
    const { data, error } = await query;
    const paths = [...new Set((data ?? []).flatMap(c => c.image_path ? [c.image_path as string] : []))];
    const urls = paths.length ? (await supabase.storage.from('challenge-images').createSignedUrls(paths, 3600)).data : [];
    const signed = new Map((urls ?? []).flatMap(item => item.path && item.signedUrl && !item.error ? [[item.path, item.signedUrl]] : []));
    content = error ? <p role="alert">Challenges couldn’t be loaded. Please refresh to try again.</p> : !data?.length ? <section className="empty-challenges">
      <h2>{selected === 'yours' ? 'Your first challenger is waiting.' : 'No open rounds right now.'}</h2>
      <p>{selected === 'yours' ? 'Choose an image, write a caption, and take on AI.' : 'Explore the results, or start a new round with your own image.'}</p>
      <div className="empty-actions"><Link className="button button-primary" href="/challenges/new">Start a challenge</Link><Link className="button" href="/challenges?view=results">Explore results</Link></div>
    </section> : <><ul className="challenge-feed">{data.map(c => {
      const image = c.image_path ? signed.get(c.image_path) : c.template_url;
      const closed = c.closes_at && new Date(c.closes_at).getTime() <= new Date().getTime();
      return <li key={c.id}><Link className="challenge-feed-card" href={`/challenges/${c.id}`}>
        <div className="challenge-feed-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image ? <img src={image} alt={c.image_description || c.situation} loading="lazy" /> : <span className="muted">Image unavailable</span>}
        </div>
        <div className="challenge-feed-content"><span className="eyebrow">{c.hidden_at ? 'Hidden' : c.status !== 'published' ? `Your ${c.status}` : closed ? 'Results ready' : 'Voting open'}</span>
          {c.joke_context && <h2>{c.joke_context}</h2>}
          {c.closes_at && !c.hidden_at && <p className="muted">{closed ? 'Closed' : 'Closes'} <time dateTime={c.closes_at}>{new Date(c.closes_at).toUTCString()}</time></p>}
          <span className="challenge-card-action">{c.hidden_at ? 'View your challenge' : c.status !== 'published' ? 'Continue your draft' : closed ? 'See the reveal' : 'Pick the funnier caption'} →</span>
        </div>
      </Link></li>;
    })}</ul>{data.length === 50 && <p className="muted">Showing the latest 50 challenges.</p>}</>;
  }
  return <><a className="skip-link" href="#challenges">Skip to challenges</a><SiteHeader />
    <main className="page-shell challenge-home" id="challenges">
      <div className="challenge-hero"><span className="eyebrow">One image. You versus AI.</span><h1>{user ? 'Let the captions compete.' : 'Can you out-caption AI?'}</h1><p>Pick the funnier caption. Find out who wrote it when the round ends.</p></div>
      {user && <nav className="challenge-tabs" aria-label="Challenge filters">{tabs.map(tab => <Link key={tab.value} href={`/challenges?view=${tab.value}`} aria-current={selected === tab.value ? 'page' : undefined}>{tab.label}</Link>)}</nav>}
      {content}
    </main>
  </>;
}

async function CompletedRounds() {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.from('challenges').select('id,situation').eq('status', 'published').is('hidden_at', null).lte('closes_at', new Date().toISOString()).order('closes_at', { ascending: false }).limit(50);
  if (error) return <p role="alert">Finished rounds couldn’t be loaded.</p>;
  return data?.length ? <section className="completed-rounds"><h2>Finished rounds</h2><p className="muted">Including ties and rounds without votes.</p><ul>{data.map(c => <li key={c.id}><Link href={`/challenges/${c.id}`}>{c.situation} <span aria-hidden="true">→</span></Link></li>)}</ul></section> : null;
}
