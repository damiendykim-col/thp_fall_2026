import { createClient } from "@supabase/supabase-js";

export type GalleryImage = {
  id: string;
  image_url: string;
  description: string | null;
  created_at: string;
};

export async function getImages(): Promise<GalleryImage[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  // Public read access: no auth session is created or persisted.
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  const { data, error } = await supabase.from("images")
    .select("id, image_url, description, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to fetch images: ${error.message}`);
  return data ?? [];
}
