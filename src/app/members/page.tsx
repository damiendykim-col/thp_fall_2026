import { measureOperation } from "@/lib/performance";
import { signAvatars } from "@/lib/avatars";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { requireCompleteProfile } from "@/lib/auth";

type MemberProfile = { id: string; avatar_path: string | null; favorite_joke: string | null };

export default async function MembersPage() {
  const { supabase } = await requireCompleteProfile();
  const { data: members, error } = await measureOperation("members.list", () => supabase.from("member_profiles")
    .select("id:profile_id, avatar_path:current_avatar_path, favorite_joke").eq("is_listed", true)) as {
    data: MemberProfile[] | null;
    error: { message: string } | null;
  };
  const signed = await signAvatars(supabase, (members ?? []).map(member => member.avatar_path), "members.avatars");
  const membersWithPhotos = (members ?? []).map(member => ({
    id: member.id, favoriteJoke: member.favorite_joke,
    avatarUrl: member.avatar_path ? signed.get(member.avatar_path) ?? null : null,
    hasPhoto: Boolean(member.avatar_path),
  }));
  return <><SiteHeader /><main className="page-shell account-page">
    <h1>Members</h1>
    <p className="account-intro">See other members by profile photo and favorite joke.</p>
    {error ? <p role="alert">Members couldn’t be loaded. Please try again.</p> : membersWithPhotos.length === 0 ? <p>No member profiles are available yet.</p> : <ul className="member-list">
      {membersWithPhotos.map((member) => <li className="member-card" key={member.id}>
        <div className="member-avatar">
          {member.avatarUrl ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={member.avatarUrl} alt="Member profile photo" width={72} height={72} />
          </> : <span className="muted">{member.hasPhoto ? "Photo unavailable" : "No photo"}</span>}
        </div>
        <p>{member.favoriteJoke ?? "No favorite joke yet."}</p>
      </li>)}
    </ul>}
    <Link className="button" href="/profile">Edit profile</Link>
  </main></>;
}
