/** Tab-local recovery only: never store file bytes, blob URLs or signed URLs. */
const PREFIX = "meme-club:challenge-draft:";
export type ChallengeDraft = {
  source: string; template: string; imageId: string; submission: string;
  description: string; suggestion: string; context: string; caption: string;
  manual: boolean; confirmed: boolean; needsFile: boolean; imageReady: boolean;
};
const limits = { source: 8, template: 100, imageId: 100, submission: 100, description: 500, suggestion: 500, context: 500, caption: 280 };
export function readChallengeDraft(userId: string): ChallengeDraft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PREFIX + userId) ?? "null");
    if (!value || !["upload", "template"].includes(value.source)) return null;
    for (const [key, limit] of Object.entries(limits)) if (typeof value[key] !== "string" || value[key].length > limit) return null;
    for (const key of ["manual", "confirmed", "needsFile", "imageReady"]) if (typeof value[key] !== "boolean") return null;
    // Explicitly select fields so stored extra data cannot become part of a draft.
    return Object.fromEntries([...Object.keys(limits), "manual", "confirmed", "needsFile", "imageReady"].map(key => [key, value[key]])) as ChallengeDraft;
  } catch { return null; }
}
export function writeChallengeDraft(userId: string, draft: ChallengeDraft | null): boolean {
  try {
    if (draft) sessionStorage.setItem(PREFIX + userId, JSON.stringify(draft));
    else sessionStorage.removeItem(PREFIX + userId);
    return true;
  } catch { return false; }
}
export function clearChallengeDrafts() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage may be disabled. */ }
}
