import { defineConfig, devices } from "@playwright/test";
import { localEnvironment } from "./e2e/env";

const env = localEnvironment();
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next dev --webpack --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      E2E_AUTH_ENABLED: "true",
      E2E_BUILD: "true",
      NEXT_PUBLIC_SUPABASE_URL: env.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: env.serviceKey,
      SUPABASE_SECRET_KEY: "",
      GEMINI_API_KEY: "",
      LLM_PROVIDER: "mock",
    },
  },
});
