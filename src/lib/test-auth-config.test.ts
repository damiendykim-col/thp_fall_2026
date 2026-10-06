import { isTestAuthEnabled } from "./test-auth-config";

const local = { NODE_ENV: "development", E2E_AUTH_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55421" };
it("allows explicitly enabled local development only", () => {
  expect(isTestAuthEnabled(local)).toBe(true);
});
it.each([
  { E2E_AUTH_ENABLED: undefined },
  { E2E_AUTH_ENABLED: "false" },
  { NODE_ENV: "production" },
  { NODE_ENV: "test" },
  { VERCEL: "1" },
  { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
  { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1.example.com" },
  { NEXT_PUBLIC_SUPABASE_URL: "http://user:password@localhost:55421" },
  { NEXT_PUBLIC_SUPABASE_URL: "garbage" },
])("denies the bypass for %o", overrides => {
  expect(isTestAuthEnabled({ ...local, ...overrides })).toBe(false);
});
