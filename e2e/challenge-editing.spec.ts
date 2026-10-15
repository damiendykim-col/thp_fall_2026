import { test, expect, login, approveForTest } from "./fixtures";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

test("draft revisions invalidate affected content, reject stale saves, and preserve published votes", async ({ accounts }) => {
  const owner = await accounts.create();
  const other = await accounts.create();
  const { data: templates } = await accounts.admin.from("images").select("id").limit(1);
  const template = templates![0].id;
  const { data: id, error } = await accounts.admin.rpc("create_reviewed_challenge", {
    p_owner: owner.id, p_image_id: null, p_template: template, p_description: "A yellow square.",
    p_context: "Monday", p_caption: "Original joke", p_confirmed: true, p_manual: false, p_submission: randomUUID(),
  });
  expect(error).toBeNull();
  const revision = { p_owner: owner.id, p_challenge: id, p_revision: 0, p_image_id: null, p_template: template,
    p_description: "A yellow square.", p_context: "Monday", p_caption: "Edited joke", p_confirmed: true, p_manual: false };
  const generate = async () => {
    const { data: request, error: claim } = await accounts.admin.rpc("claim_caption_generation", { p_owner: owner.id, p_challenge: id, p_provider: "mock", p_model: "test", p_prompt: {} });
    expect(claim).toBeNull();
    expect((await accounts.admin.rpc("finish_caption_generation", { p_request: request, p_caption: "AI joke" })).error).toBeNull();
  };
  await generate();
  await approveForTest(accounts.admin, owner.id, id);
  const before = (await accounts.admin.from("challenges").select("*").eq("id", id).single()).data!;
  for (const client of [accounts.anonymous, owner.client, other.client]) {
    expect((await client.rpc("revise_caption_challenge", revision)).error).toBeTruthy();
  }
  expect((await accounts.admin.rpc("revise_caption_challenge", { ...revision, p_owner: other.id })).error).toBeTruthy();
  expect((await accounts.admin.rpc("revise_caption_challenge", revision)).error).toBeNull();
  const captionEdit = (await accounts.admin.from("challenges").select("*").eq("id", id).single()).data!;
  expect(captionEdit.revision).toBe(1);
  expect(captionEdit.human_moderation_id).toBeNull();
  expect(captionEdit.ai_moderation_id).toBe(before.ai_moderation_id);
  expect(captionEdit.status).toBe("ready");
  expect((await owner.client.rpc("publish_caption_challenge", { p_challenge: id })).error).toBeTruthy();
  expect((await accounts.admin.rpc("revise_caption_challenge", revision)).error?.code).toBe("40001");
  const sceneEdit = { ...revision, p_revision: 1, p_context: "Tuesday" };
  expect((await accounts.admin.rpc("revise_caption_challenge", sceneEdit)).error).toBeNull();
  const reset = (await accounts.admin.from("challenges").select("*").eq("id", id).single()).data!;
  expect(reset.status).toBe("draft"); expect(reset.revision).toBe(2);
  expect(reset.ai_moderation_id).toBeNull(); expect(reset.human_moderation_id).toBeNull();
  expect((await accounts.admin.from("challenge_captions").select("origin").eq("challenge_id", id)).data).toEqual([{ origin: "human" }]);
  expect((await owner.client.from("challenge_generations").select("id").eq("challenge_id", id)).data).toHaveLength(1);
  expect((await accounts.admin.rpc("claim_reviewed_caption_generation", { p_owner: owner.id, p_challenge: id, p_revision: 1, p_provider: "mock", p_model: "test", p_prompt: {} })).error).toBeTruthy();
  const request = await accounts.admin.rpc("claim_reviewed_caption_generation", { p_owner: owner.id, p_challenge: id, p_revision: 2, p_provider: "mock", p_model: "test", p_prompt: {} });
  expect(request.error).toBeNull();
  expect((await accounts.admin.rpc("revise_caption_challenge", { ...sceneEdit, p_revision: 2, p_context: "Wednesday" })).error).toBeTruthy();
  expect((await accounts.admin.rpc("finish_caption_generation", { p_request: request.data, p_caption: "New AI joke" })).error).toBeNull();
  await approveForTest(accounts.admin, owner.id, id);
  expect((await owner.client.rpc("publish_caption_challenge", { p_challenge: id })).error).toBeNull();
  const view = (await other.client.rpc("read_caption_challenge", { p_challenge: id })).data;
  expect((await other.client.rpc("vote_caption_challenge", { p_challenge: id, p_caption: view.captions[0].id })).error).toBeNull();
  expect((await accounts.admin.rpc("revise_caption_challenge", { ...sceneEdit, p_revision: 2 })).error).toBeTruthy();
  expect((await other.client.from("challenge_votes").select("caption_id").eq("challenge_id", id)).data).toHaveLength(1);
});

test("creator can edit a populated draft, keep AI for caption edits, and regenerate after scene edits", async ({ page, accounts }) => {
  const owner = await accounts.create();
  await login(page, owner);
  await page.goto("/challenges/new");
  await page.getByLabel("Image source").selectOption("template");
  const option = await page.getByLabel("Gallery template").locator("option:not([disabled])").first().getAttribute("value");
  await page.getByLabel("Gallery template").selectOption(option!);
  await page.getByText("Review image understanding", { exact: true }).click();
  await page.getByLabel("I confirm this image description").check();
  await page.getByRole("button", { name: "2. Your caption" }).click();
  await page.getByLabel("Your caption").fill("My original joke");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page).toHaveURL(/\/challenges\/[0-9a-f-]+$/);
  const url = page.url();
  await page.getByRole("button", { name: "Generate AI opponent", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish for 24 hours", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit challenge", exact: true }).click();
  await expect(page.getByLabel("Your caption")).toHaveValue("My original joke");
  await page.getByLabel("Your caption").fill("[[test:block]]");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Please revise");
  await page.getByLabel("Your caption").fill("My corrected joke");
  await page.reload();
  await expect(page.getByLabel("Your caption")).toHaveValue("My corrected joke");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByText("My corrected joke", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish for 24 hours", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit challenge", exact: true }).click();
  await page.getByLabel("Add context for the joke (optional)").fill("Finals week");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("button", { name: "Generate AI opponent", exact: true })).toBeVisible();
  await expect(page.getByText("AI caption", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Generate AI opponent", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish for 24 hours", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit challenge", exact: true }).click();
  await page.getByLabel("Image source").selectOption("upload");
  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "yellow" } }).png().toBuffer();
  await page.getByLabel("Challenge image").setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: png });
  await page.getByText("Review image understanding", { exact: true }).click();
  await expect(page.getByLabel("Image description", { exact: true })).toHaveValue("A yellow square fills the image.");
  await page.getByLabel("I confirm this image description").check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByText("AI caption", { exact: true })).toHaveCount(0);
  const changed = (await owner.client.from("challenges").select("image_id,template_id").eq("id", url.split("/").pop()!).single()).data!;
  expect(changed.image_id).toBeTruthy(); expect(changed.template_id).toBeNull();
  await page.getByRole("button", { name: "Generate AI opponent", exact: true }).click();
  await page.getByRole("button", { name: "Publish for 24 hours", exact: true }).click();
  await expect(page.getByText("Your challenge · Waiting for the community’s votes.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit challenge", exact: true })).toHaveCount(0);
  await page.goto(`${url}/edit`);
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
});


test("editing and generation cannot both claim the same revision concurrently", async ({ accounts }) => {
  const owner = await accounts.create();
  const template = (await accounts.admin.from("images").select("id").limit(1)).data![0].id;
  const { data: id, error } = await accounts.admin.rpc("create_reviewed_challenge", {
    p_owner: owner.id, p_image_id: null, p_template: template, p_description: "A scene", p_context: "Monday",
    p_caption: "A joke", p_confirmed: true, p_manual: false, p_submission: randomUUID(),
  });
  expect(error).toBeNull();
  const [edit, generation] = await Promise.all([
    accounts.admin.rpc("revise_caption_challenge", { p_owner: owner.id, p_challenge: id, p_revision: 0, p_image_id: null,
      p_template: template, p_description: "New scene", p_context: "Monday", p_caption: "A joke", p_confirmed: true, p_manual: false }),
    accounts.admin.rpc("claim_reviewed_caption_generation", { p_owner: owner.id, p_challenge: id, p_revision: 0, p_provider: "mock", p_model: "test", p_prompt: {} }),
  ]);
  expect([edit, generation].filter(r => !r.error)).toHaveLength(1);
  const row = (await accounts.admin.from("challenges").select("revision,status").eq("id", id).single()).data!;
  expect(row).toEqual(edit.error ? { revision: 0, status: "generating" } : { revision: 1, status: "draft" });
});
