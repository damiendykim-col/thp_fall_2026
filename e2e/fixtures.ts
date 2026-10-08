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
      // Curated test fixtures only. Production templates require a moderator's visual review.
      const { data: templates, error: templateError } = await admin.from("images").select("id,image_url");
      if (templateError) throw templateError;
      const { error: reviewError } = await admin.from("challenge_template_reviews").upsert((templates ?? []).map(t => ({ template_id: t.id, image_url: t.image_url, policy_version: "moderation-v1" })));
      if (reviewError) throw reviewError;
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

// Explicit trusted fixtures for tests that construct ready challenges without provider calls.
export async function approveForTest(admin: SupabaseClient, owner: string, challengeId: string) {
  const ids: Record<string, string> = {};
  for (const phase of ["image", "human", "ai"]) {
    const { data, error } = await admin.from("moderation_checks").insert({ owner_id: owner, phase, input_hash: randomUUID(), policy_version: "moderation-v1", provider: "mock", model: "fixture", status: "approved", category: "none" }).select("id").single();
    if (error || !data) throw error ?? new Error("Moderation fixture missing");
    ids[phase] = data.id;
  }
  const { error } = await admin.from("challenges").update({ asset_moderation_id: ids.image, human_moderation_id: ids.human, ai_moderation_id: ids.ai }).eq("id", challengeId);
  if (error) throw error;
}
