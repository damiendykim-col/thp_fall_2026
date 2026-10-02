import { Suspense } from "react";
import Loading from "./loading";
import SiteHeader from "@/components/site-header";
import { connection } from "next/server";
import { getImages, type GalleryImage } from "@/lib/images";
import Gallery from "./gallery";

async function ImageFeed() {
  let images: GalleryImage[] = [];
  let failed = false;
  try { images = await getImages(); }
  catch (error) { console.error("Gallery load failed", error); failed = true; }
  return <main className="page-shell">
      <section id="feed" aria-label="Image feed" tabIndex={-1}>
        {failed ? <div className="status-panel" role="alert"><h2>Unable to load images.</h2><p>We couldn’t load the images. Try again in a moment.</p><a className="button" href="/images">Try again</a></div> : <Gallery images={images} />}
      </section>
    </main>;
}

export default async function ImagesPage() {
  await connection();
  return <>
    <a className="skip-link" href="#feed">Skip to the feed</a>
    <Suspense fallback={<header className="site-header" aria-busy="true">meme club</header>}><SiteHeader /></Suspense>
    <Suspense fallback={<Loading />}><ImageFeed /></Suspense>
  </>;
}
