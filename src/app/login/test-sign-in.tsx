"use client";

import { useActionState } from "react";
import { testSignIn } from "./test-actions";

export default function TestSignIn() {
  const [result, action, pending] = useActionState(testSignIn, {});
  return <section className="status-panel" aria-label="Local test sign-in">
    <h2>Local test sign-in</h2>
    <p>Sign in to local Supabase without Google.</p>
    <form className="profile-form" action={action}>
      <label>Test email<input name="email" type="email" autoComplete="username" required /></label>
      <label>Test password<input name="password" type="password" autoComplete="current-password" required /></label>
      {result.error && <p role="alert">{result.error}</p>}
      <button className="button" disabled={pending}>{pending ? "Signing in…" : "Sign in with test account"}</button>
    </form>
  </section>;
}
