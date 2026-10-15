import { clearChallengeDrafts, readChallengeDraft, writeChallengeDraft, type ChallengeDraft } from "./challenge-draft";
const draft: ChallengeDraft = {
  source: "upload", template: "", imageId: "image-1", submission: "submission-1",
  description: "A square", suggestion: "A square", context: "Finals", caption: "My joke",
  manual: false, confirmed: true, needsFile: false, imageReady: true,
};
beforeEach(() => sessionStorage.clear());
test("draft validation rejects corrupt and oversized data", () => {
  sessionStorage.setItem("meme-club:challenge-draft:u", "broken JSON");
  expect(readChallengeDraft("u")).toBeNull();
  writeChallengeDraft("u", { ...draft, caption: "x".repeat(281) });
  expect(readChallengeDraft("u")).toBeNull();
});
test("drafts remain account scoped and clearing preserves unrelated storage", () => {
  writeChallengeDraft("a", draft);
  writeChallengeDraft("b", { ...draft, caption: "Other joke" });
  expect(readChallengeDraft("a")?.caption).toBe("My joke");
  expect(readChallengeDraft("b")?.caption).toBe("Other joke");
  sessionStorage.setItem("unrelated", "keep");
  clearChallengeDrafts();
  expect(readChallengeDraft("a")).toBeNull();
  expect(readChallengeDraft("b")).toBeNull();
  expect(sessionStorage.getItem("unrelated")).toBe("keep");
});
test("blocked browser storage does not break creation", () => {
  const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(readChallengeDraft("a")).toBeNull();
  expect(writeChallengeDraft("a", draft)).toBe(false);
  get.mockRestore(); set.mockRestore();
});
