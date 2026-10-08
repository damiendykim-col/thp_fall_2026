import Link from "next/link";
import { Suspense } from "react";
import SiteHeader from "@/components/site-header";
import { connection } from "next/server";
import { getImages, type GalleryImage } from "@/lib/images";
import { createAuthClient } from "@/lib/supabase/server";
import { getChallengeWinners, type ChallengeWinner } from "@/lib/challenges/winners";
import Gallery from "./gallery";
import Winners from "./winners";

async function ImageFeed({templates}: {templates:boolean}) {
  let images: GalleryImage[] = [];
  let winners: ChallengeWinner[] = [];
  let signedIn = false;
  let failed = false;
  try {
    if (templates) images = await getImages();
    else {
      const supabase=await createAuthClient();
      const {data:{user},error}=await supabase.auth.getUser();
      if (error && error.name !== "AuthSessionMissingError") throw error;
      signedIn=Boolean(user);
      if (user) winners=await getChallengeWinners(supabase);
    }
  } catch { failed = true; }
  if (failed) return <div className="status-panel" role="alert"><h2>Unable to load {templates?"templates":"winners"}.</h2><p>Please try again in a moment.</p><Link className="button" href={`/images?view=${templates?"templates":"winners"}`}>Try again</Link></div>;
  if (templates) return <Gallery images={images} embedded />;
  if (!signedIn) return <div className="status-panel"><h2>Sign in to browse winning captions.</h2><p>Challenge results are shared with signed-in members. Templates are available to everyone.</p><Link className="button button-primary" href="/login">Sign in</Link></div>;
  return <Winners winners={winners} />;
}

export default async function ImagesPage({searchParams}: {searchParams: Promise<{view?:string|string[]}>}) {
  await connection();
  const templates=(await searchParams)?.view==="templates";
  return <>
    <a className="skip-link" href="#feed">Skip to the feed</a>
    <Suspense fallback={<header className="site-header" aria-busy="true">meme club</header>}><SiteHeader /></Suspense>
    <main className="page-shell images-page">
      <div className="images-heading"><h1>Images</h1><Link className="button" href="/challenges/new">Create challenge</Link></div>
      <nav className="image-collections" aria-label="Image collections">
        <Link href="/images" aria-current={!templates?"page":undefined}>Winners</Link>
        <Link href="/images?view=templates" aria-current={templates?"page":undefined}>Templates</Link>
      </nav>
      <section id="feed" aria-label="Image feed" tabIndex={-1}>
        <Suspense key={templates?"templates":"winners"} fallback={<div className="status-panel" role="status">Loading images…</div>}><ImageFeed templates={templates} /></Suspense>
      </section>
    </main>
  </>;
}
