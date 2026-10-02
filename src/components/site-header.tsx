import Link from "next/link";
import { createAuthClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { measureOperation } from "@/lib/performance";

export default async function SiteHeader() {
  const supabase = await createAuthClient();
  const { data: { user } } = await measureOperation("header.auth", () => supabase.auth.getUser());
  return <header className="site-header">
    <Link href="/" className="wordmark" aria-label="Meme Club home">meme club</Link>
    <nav className="account-nav" aria-label="Main navigation">
      <Link href="/images" className="nav-link">Images</Link>
      {user ? <><Link href="/members" className="nav-link">Members</Link><Link href="/profile" className="nav-link">Profile</Link><form action={signOut}><button className="nav-link text-button">Sign out</button></form></> : <Link href="/login" className="nav-link">Sign in</Link>}
    </nav>
  </header>;
}
