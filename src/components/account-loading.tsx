import Link from "next/link";

export default function AccountLoading({ title }: { title: "Members" | "Profile" | "Challenges" }) {
  return <>
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Meme Club home">meme club</Link>
      <nav className="account-nav" aria-label="Main navigation">
        <Link href="/images" className="nav-link">Images</Link>
        <Link href="/challenges" className="nav-link">Challenges</Link>
        <Link href="/members" className="nav-link">Members</Link>
        <Link href="/profile" className="nav-link">Profile</Link>
      </nav>
    </header>
    <main className="page-shell account-page" aria-busy="true">
      <h1>{title}</h1>
      <p className="account-intro" role="status">Loading {title.toLowerCase()}…</p>
      <div className="account-loading-blocks" aria-hidden="true">
        <div className="account-loading-block account-loading-photo" />
        <div className="account-loading-block" />
        <div className="account-loading-block" />
      </div>
    </main>
  </>;
}
