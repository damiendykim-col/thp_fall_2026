import Link from "next/link";
import { connection } from "next/server";
import { getImages, type GalleryImage } from "@/lib/images";
import Gallery from "./gallery";

export default async function ImagesPage() {
  await connection();
  let images: GalleryImage[] = [];
  let failed = false;
  try { images = await getImages(); }
  catch (error) { console.error("Gallery load failed", error); failed = true; }
  return <>
    <a className="skip-link" href="#feed">Skip to the feed</a>
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Meme Club home">meme club</Link>
      <Link href="/images" className="nav-link" aria-current="page">Images</Link>
    </header>
    <main className="page-shell">
      <section id="feed" aria-label="Image feed" tabIndex={-1}>
        {failed ? <div className="status-panel" role="alert"><h2>Unable to load images.</h2><p>We couldn’t load the images. Try again in a moment.</p><a className="button" href="/images">Try again</a></div> : <Gallery images={images} />}
      </section>
    </main>

  </>;
}
