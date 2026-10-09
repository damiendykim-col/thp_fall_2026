// Compatibility route for earlier assignments and bookmarked template links.
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/site-header';
import { getImages } from '@/lib/images';
import Gallery from './gallery';

async function Templates() {
  const images = await getImages().catch(() => null);
  return images ? <Gallery images={images} embedded /> : <p role="alert">Templates couldn’t be loaded. Please refresh to try again.</p>;
}

export default async function ImagesPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  if ((await searchParams).view !== 'templates') redirect('/challenges?view=results');
  return <><SiteHeader /><main className="page-shell images-page">
    <div className="images-heading"><h1>Images</h1><Link href="/challenges/new">Use a template in a challenge →</Link></div>
    <Suspense fallback={<p role="status">Loading templates…</p>}><Templates /></Suspense>
  </main></>;
}
