"use client";
import { signOut } from "@/app/auth/actions";
import { clearProfileDrafts } from "@/lib/profile-draft";
export default function SignOut() {
  return <form action={signOut} onSubmit={clearProfileDrafts}><button className="nav-link text-button">Sign out</button></form>;
}
