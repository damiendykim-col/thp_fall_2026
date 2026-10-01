import Link from "next/link";

export default function AuthErrorPage() {
  return <main className="page-shell account-page"><h1>Sign-in wasn’t completed</h1><p className="account-intro">The request may have expired or been cancelled. Start again in the same browser.</p><Link className="button" href="/login">Back to sign in</Link></main>;
}
