export const DRAFT_PREFIX = "meme-club:profile-draft:";
export type ProfileDraft = { first: string; last: string; joke: string; previous: string; needsFile: boolean };
export function readDraft(userId: string): ProfileDraft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(DRAFT_PREFIX + userId) ?? "null");
    if (!value || ![value.first, value.last, value.joke, value.previous].every(v => typeof v === "string") || typeof value.needsFile !== "boolean") return null;
    if (value.first.length > 80 || value.last.length > 80 || value.joke.length > 280 || value.previous.length > 1024) return null;
    return value;
  } catch { return null; }
}
export function writeDraft(userId: string, draft: ProfileDraft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_PREFIX + userId, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_PREFIX + userId);
  } catch { /* Draft recovery is optional when browser storage is unavailable. */ }
}
export function clearProfileDrafts() {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(DRAFT_PREFIX)) sessionStorage.removeItem(key);
  } catch { /* Signing out must still work when storage is unavailable. */ }
}
