/** @jest-environment node */
import HomePage from "./page";
import { redirect } from "next/navigation";
jest.mock("next/navigation", () => ({ redirect: jest.fn(() => { throw new Error("redirect"); }) }));
jest.mock("./challenges/page", () => ({ __esModule: true, default: () => null }));
const go = jest.mocked(redirect);
beforeEach(() => jest.clearAllMocks());

test("an OAuth code returned to the site root reaches the callback instead of a signed-out gallery", async () => {
  await expect(HomePage({ searchParams: Promise.resolve({code:"test-code",next:"https://untrusted.example"}) })).rejects.toThrow("redirect");
  expect(go).toHaveBeenCalledWith("/auth/callback?code=test-code");
});
test("an OAuth error returned to the site root reaches the error handler without echoing provider details", async () => {
  await expect(HomePage({ searchParams: Promise.resolve({error:"access_denied",error_description:"private provider detail"}) })).rejects.toThrow("redirect");
  expect(go).toHaveBeenCalledWith("/auth/callback?error=access_denied");
});
test("ordinary home visits render challenges", async () => {
  await HomePage({searchParams:Promise.resolve({})});
  expect(go).not.toHaveBeenCalled();
});
