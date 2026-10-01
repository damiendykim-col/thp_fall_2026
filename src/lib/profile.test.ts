import { isProfileComplete, validateFavoriteJoke, validateNames } from "./profile";

describe("Profile completion", () => {
  it.each([null, { first_name: null, last_name: null }, { first_name: "Ada", last_name: " " }, { first_name: "", last_name: "Lovelace" }])("requires both nonblank names: %p", (profile) => {
    expect(isProfileComplete(profile)).toBe(false);
  });
  it("accepts names without assumptions about language or punctuation", () => {
    expect(isProfileComplete({ first_name: "지민", last_name: "김" })).toBe(true);
    expect(validateNames("Anne-Marie", "O’Neill")).toBeNull();
  });
  it("rejects invalid types and overly long names", () => {
    expect(validateNames(null, "Name")).not.toBeNull();
    expect(validateNames(" ", "Name")).not.toBeNull();
    expect(validateNames("a".repeat(81), "Name")).not.toBeNull();
  });
  it("accepts blank jokes but validates type and length", () => {
    expect(validateFavoriteJoke(null)).toBeNull();
    expect(validateFavoriteJoke("   ")).toBeNull();
    expect(validateFavoriteJoke("Why did the chicken cross the road?")).toBeNull();
    expect(validateFavoriteJoke("x".repeat(281))).not.toBeNull();
  });
});
