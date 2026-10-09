"use client";

import { prepareSignIn } from "./prepare-sign-in";
import { useState } from "react";
import { createAuthBrowserClient } from "@/lib/supabase/browser";

export default function SignIn({ destination = "/challenges" }: { destination?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signIn() {
    setPending(true);
    setError("");
    try {
      await prepareSignIn(destination);
      const { error } = await createAuthBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      setError("Couldn’t start Google sign-in. Please try again.");
      setPending(false);
    }
  }
  return <>
    <button className="button button-primary" onClick={signIn} disabled={pending}>{pending ? "Connecting…" : "Continue with Google"}</button>
    {error && <p role="alert">{error}</p>}
  </>;
}
