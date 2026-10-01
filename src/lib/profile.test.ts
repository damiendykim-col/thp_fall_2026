import { isProfileComplete, validateNames } from "./profile";

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
});
