import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createAuthClient({ writableCookies = false }: { writableCookies?: boolean } = {}) {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch (error) {
          if (writableCookies) throw error;
          // Server Components cannot write cookies. Proxy refreshes them first.
        }
      },
    },
  });
}
