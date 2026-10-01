/** @jest-environment node */
import { GET } from "./route";
import { createAuthClient } from "@/lib/supabase/server";
jest.mock("@/lib/supabase/server", () => ({ createAuthClient: jest.fn() }));
const createClient = jest.mocked(createAuthClient);
beforeEach(() => jest.clearAllMocks());
it("rejects callbacks without a code", async () => {
  const response = await GET(new Request("https://example.com/auth/callback"));
  expect(response.headers.get("location")).toBe("https://example.com/auth/error");
  expect(createClient).not.toHaveBeenCalled();
});
it.each([false, true])("routes based on profile completion, ignoring custom destinations: %s", async (complete) => {
  const exchange = jest.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  createClient.mockResolvedValue({
    auth: { exchangeCodeForSession: exchange },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: "Ada", last_name: complete ? "Lovelace" : null } }) }) }) }),
  } as unknown as Awaited<ReturnType<typeof createAuthClient>>);
  const response = await GET(new Request("https://example.com/auth/callback?code=abc&next=https://evil.example"));
  expect(exchange).toHaveBeenCalledWith("abc");
  expect(response.headers.get("location")).toBe(`https://example.com/${complete ? "members" : "profile"}`);
});
it("shows a recoverable error for an expired code", async () => {
  createClient.mockResolvedValue({ auth: { exchangeCodeForSession: async () => ({ data: {}, error: new Error("expired") }) } } as unknown as Awaited<ReturnType<typeof createAuthClient>>);
  const response = await GET(new Request("https://example.com/auth/callback?code=expired"));
  expect(response.headers.get("location")).toBe("https://example.com/auth/error");
});
