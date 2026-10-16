/** @jest-environment node */
import { GET } from "./route";
import { createAuthClient } from "@/lib/supabase/server";
jest.mock("@/lib/supabase/server", () => ({ createAuthClient: jest.fn() }));
const cookieGet = jest.fn();
jest.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet, delete: jest.fn() }) }));
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
  expect(response.headers.get("location")).toBe(`https://example.com/${complete ? "challenges" : "profile?next=%2Fchallenges"}`);
});
it("shows a recoverable error for an expired code", async () => {
  createClient.mockResolvedValue({ auth: { exchangeCodeForSession: async () => ({ data: {}, error: new Error("expired") }) } } as unknown as Awaited<ReturnType<typeof createAuthClient>>);
  const response = await GET(new Request("https://example.com/auth/callback?code=expired"));
  expect(response.headers.get("location")).toBe("https://example.com/auth/error");
});
it.each(['/challenges/new', '/challenges/12345678-1234-1234-1234-123456789abc', '//evil.example'])('uses only allowed return-cookie destinations: %s', async value => {
  cookieGet.mockReturnValue({ value });
  createClient.mockResolvedValue({
    auth: { exchangeCodeForSession: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: 'Ada', last_name: 'Lovelace' } }) }) }) }),
  } as unknown as Awaited<ReturnType<typeof createAuthClient>>);
  const response = await GET(new Request('https://example.com/auth/callback?code=abc'));
  expect(response.headers.get('location')).toBe(`https://example.com${value.startsWith('//') ? '/challenges' : value}`);
});
it('reports the exchange failure code without logging the OAuth code or provider message', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  createClient.mockResolvedValue({ auth: { exchangeCodeForSession: async () => ({ data: {}, error: { code: 'bad_code_verifier', message: 'private details' } }) } } as unknown as Awaited<ReturnType<typeof createAuthClient>>);
  await GET(new Request('https://example.com/auth/callback?code=secret-code'));
  expect(createClient).toHaveBeenCalledWith({ writableCookies: true });
  expect(log).toHaveBeenCalledWith({ event: 'app-operation', operation: 'auth.exchange', outcome: 'failed', code: 'bad_code_verifier' });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret-code|private details/);
  log.mockRestore();
});
it('shows a recoverable error when the callback cannot persist cookies', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  createClient.mockRejectedValueOnce(new Error('Private cookie details'));
  const response = await GET(new Request('https://example.com/auth/callback?code=abc'));
  expect(response.headers.get('location')).toBe('https://example.com/auth/error');
  expect(log).toHaveBeenCalledWith({ event: 'app-operation', operation: 'auth.callback', outcome: 'failed' });
  log.mockRestore();
});
