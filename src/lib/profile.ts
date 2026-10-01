export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
};

export function isProfileComplete(profile: Pick<Profile, "first_name" | "last_name"> | null) {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}

export function validateNames(first: unknown, last: unknown) {
  if (typeof first !== "string" || typeof last !== "string" || !first.trim() || !last.trim()) {
    return "Enter both your first and last name.";
  }
  if (first.trim().length > 80 || last.trim().length > 80) {
    return "Each name must be 80 characters or fewer.";
  }
  return null;
}

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};
