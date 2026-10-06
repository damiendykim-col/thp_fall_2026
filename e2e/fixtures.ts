import { test as base, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { localEnvironment } from "./env";

type Account = { id: string; email: string; password: string; client: SupabaseClient };
type Accounts = { create: () => Promise<Account>; admin: SupabaseClient; anonymous: SupabaseClient };
const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

export const test = base.extend<{ accounts: Accounts }>({
  accounts: async ({}, provide) => {
    const env = localEnvironment();
    const admin = createClient(env.url, env.serviceKey, { auth: authOptions });
    const created: Account[] = [];
    try {
      await provide({
        admin,
        anonymous: createClient(env.url, env.anonKey, { auth: authOptions }),
        async create() {
          const email = `e2e-${randomUUID()}@example.test`;
          const password = randomUUID();
          const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
          if (error || !data.user) throw error ?? new Error("Test account creation failed.");
          const client = createClient(env.url, env.anonKey, { auth: authOptions });
          const account = { id: data.user.id, email, password, client };
          created.push(account);
          const { error: loginError } = await client.auth.signInWithPassword({ email, password });
          if (loginError) throw loginError;
          return account;
        },
      });
    } finally {
      // Only remove accounts and files created by this test; never list/delete all users.
      for (const account of created) {
        for (const bucket of ["avatars", "challenge-images"]) {
        const { data: files, error: listError } = await admin.storage.from(bucket).list(account.id);
        if (listError) throw listError;
        if (files?.length) {
          const { error } = await admin.storage.from(bucket).remove(files.map(f => `${account.id}/${f.name}`));
          if (error) throw error;
        }
        }
        const { error } = await admin.auth.admin.deleteUser(account.id);
        if (error) throw error;
      }
    }
  },
});
export { expect };

export async function login(page: Page, account: Account) {
  await page.goto("/login");
  await page.getByLabel("Test email", { exact: true }).fill(account.email);
  await page.getByLabel("Test password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in with test account", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
}
export async function completeProfile(page: Page, joke = "A SQL query walks into a bar.") {
  await page.getByRole("textbox", { name: "First name", exact: true }).fill("PrivateFirst");
  await page.getByRole("textbox", { name: "Last name", exact: true }).fill("PrivateLast");
  await page.getByRole("textbox", { name: "Favorite joke", exact: true }).fill(joke);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile saved.", { exact: false })).toBeVisible();
}
export const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
