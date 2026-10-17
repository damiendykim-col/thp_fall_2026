import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { measureOperation } from "@/lib/performance";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // The callback owns the new session exchange. Refreshing a stale session
  // first can clear pending PKCE cookies before it gets to read them.
  if (request.nextUrl.pathname === '/auth/callback' ||
    (request.nextUrl.pathname === '/' && (request.nextUrl.searchParams.has('code') || request.nextUrl.searchParams.has('error')))) {
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Refresh and verify sessions before Server Components read their cookies.
  await measureOperation("proxy.auth", () => supabase.auth.getUser());
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/", "/images", "/login", "/profile/:path*", "/members/:path*", "/challenges/:path*", "/auth/:path*"],
};
