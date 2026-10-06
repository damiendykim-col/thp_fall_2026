type TestAuthEnvironment = {
  NODE_ENV?: string;
  VERCEL?: string;
  E2E_AUTH_ENABLED?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
};

// Server-side feature gate. A flag alone can never enable this on a deployed app.
export function isTestAuthEnabled(env: TestAuthEnvironment = process.env) {
  if (env.E2E_AUTH_ENABLED !== "true" || env.NODE_ENV !== "development" || env.VERCEL) return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && !url.username && !url.password && url.pathname === "/";
  } catch {
    return false;
  }
}
