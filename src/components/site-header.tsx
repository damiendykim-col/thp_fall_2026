import Link from "next/link";
import { createAuthClient } from "@/lib/supabase/server";
import SignOut from "./sign-out";
import { measureOperation } from "@/lib/performance";

export default async function SiteHeader() {
  const supabase = await createAuthClient();
  const { data: { user } } = await measureOperation("header.auth", () => supabase.auth.getUser());
  const moderator = user ? (await supabase.rpc('is_moderator')).data === true : false;
  return <header className="site-header">
    <Link href="/" className="wordmark" aria-label="Meme Club home">meme club</Link>
    <nav className="account-nav" aria-label="Main navigation">
      <Link href="/challenges" className="nav-link">Challenges</Link>
      <Link href={user ? '/challenges/new' : '/login?next=%2Fchallenges%2Fnew'} className="button button-primary">Create challenge</Link>
      {user ? <details className="account-menu">
        <summary>Account</summary>
        <div className="account-menu-items">
          <Link href="/profile">Profile</Link>
          {moderator && <Link href="/moderation">Moderation</Link>}
          <SignOut />
        </div>
      </details> : <Link href="/login" className="nav-link">Sign in</Link>}
    </nav>
  </header>;
}
