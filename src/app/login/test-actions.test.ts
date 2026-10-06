/** @jest-environment node */
import { testSignIn } from "./test-actions";
import { isTestAuthEnabled } from "@/lib/test-auth-config";
import { createAuthClient } from "@/lib/supabase/server";

jest.mock("@/lib/test-auth-config", () => ({ isTestAuthEnabled: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({ createAuthClient: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("redirect:" + url); } }));
const signInWithPassword = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isTestAuthEnabled).mockReturnValue(true);
  jest.mocked(createAuthClient).mockResolvedValue({ auth: { signInWithPassword } } as unknown as Awaited<ReturnType<typeof createAuthClient>>);
});
it("rejects direct calls when disabled without creating a Supabase client", async () => {
  jest.mocked(isTestAuthEnabled).mockReturnValue(false);
  expect(await testSignIn({}, new FormData())).toEqual({ error: "Test sign-in is unavailable." });
  expect(createAuthClient).not.toHaveBeenCalled();
});
it("requires real credentials and reports invalid credentials", async () => {
  const data = new FormData(); data.set("email", "test@example.test"); data.set("password", "wrong");
  signInWithPassword.mockResolvedValue({ error: { message: "invalid" } });
  expect(await testSignIn({}, data)).toHaveProperty("error");
  expect(signInWithPassword).toHaveBeenCalledWith({ email: "test@example.test", password: "wrong" });
});
it("redirects only after Supabase establishes the session", async () => {
  const data = new FormData(); data.set("email", "test@example.test"); data.set("password", "local-password");
  signInWithPassword.mockResolvedValue({ error: null });
  await expect(testSignIn({}, data)).rejects.toThrow("redirect:/profile");
});
