import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { requireCompleteProfile } from "@/lib/auth";

export default async function MembersPage() {
  const { profile } = await requireCompleteProfile();
  return <><SiteHeader /><main className="page-shell account-page"><h1>Members</h1><p className="account-intro">Welcome, {profile.first_name}. You’re signed in.</p><p>This page is available only to members with a completed profile.</p><Link className="button" href="/profile">Edit profile</Link></main></>;
}
