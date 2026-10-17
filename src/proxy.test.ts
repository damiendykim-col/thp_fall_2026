/** @jest-environment node */
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { createServerClient } from "@supabase/ssr";
jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));
jest.mock("@/lib/performance", () => ({ measureOperation: (_: string, fn: () => unknown) => fn() }));
const getUser = jest.fn().mockResolvedValue({ data: { user: null } });
beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test";
  jest.mocked(createServerClient).mockReturnValue({ auth: { getUser } } as never);
});
test.each(["/auth/callback?code=abc", "/?code=abc", "/?error=access_denied"])("OAuth return %s reaches the exchange without old-session cleanup", async path => {
  const response = await proxy(new NextRequest("https://example.com" + path));
  expect(createServerClient).not.toHaveBeenCalled();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
test("ordinary protected pages still validate their session", async () => {
  await proxy(new NextRequest("https://example.com/profile"));
  expect(getUser).toHaveBeenCalledTimes(1);
});
