import { redirect } from "next/navigation";
import ImagesPage from "./images/page";

type Search = Record<string, string | string[] | undefined>;

export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  // Supabase can fall back to its Site URL when redirectTo isn't allowlisted.
  // Never silently render the gallery with an unexchanged OAuth code. Keep the
  // exchange in the canonical callback, on this same origin (PKCE cookies are host-bound).
  const code = typeof params.code === "string" ? params.code : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  if (code || error) {
    const callback = new URLSearchParams();
    if (code) callback.set("code", code);
    if (error) callback.set("error", error);
    redirect(`/auth/callback?${callback}`);
  }
  return <ImagesPage searchParams={Promise.resolve(params)} />;
}
