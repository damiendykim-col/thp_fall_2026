import { test, expect, login } from "./fixtures";

test("a new account has an example, and a saved draft becomes a return action", async ({ page, accounts }) => {
  const owner = await accounts.create();
  const { data: templates } = await accounts.admin.from("images").select("id,image_url").limit(1);
  const template = { template_id: templates![0].id, template_url: templates![0].image_url };
  await login(page, owner);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No open rounds right now." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a challenge", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore results" })).toHaveCount(0);
  await page.getByText("Try an example · no votes recorded", { exact: true }).click();
  const demo = page.getByRole("region", { name: "Example challenge" });
  await demo.getByRole("button").first().click();
  await expect(demo.getByRole("status")).toContainText("Example pick only");
  expect((await owner.client.from("challenge_votes").select("*")).data).toEqual([]);
  const { data: draft, error } = await accounts.admin.from("challenges").insert({ ...template, creator_id: owner.id, situation: "My unfinished scene", status: "draft" }).select("id").single();
  expect(error).toBeNull();
  await page.reload();
  const activity = page.getByRole("complementary", { name: "Pick up where you left off" });
  await expect(activity.getByRole("link", { name: "Resume your draft" })).toHaveAttribute("href", `/challenges/${draft!.id}`);
  await expect(activity.getByRole("alert")).toHaveCount(0);
  await activity.getByRole("link", { name: "Resume your draft" }).click();
  await expect(page).toHaveURL(new RegExp(`/challenges/${draft!.id}$`));
  await page.goto("/challenges?view=results");
  await expect(page.getByRole("heading", { name: "No finished rounds yet." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse challenges" })).toHaveCount(0);
});

test("voting catches up without removing cards; closing surfaces only personal results and every outcome", async ({ page, accounts }, testInfo) => {
  const owner = await accounts.create();
  const { data: templates } = await accounts.admin.from("images").select("id,image_url").limit(1);
  const template = { template_id: templates![0].id, template_url: templates![0].image_url };
  const viewer = await accounts.create();
  const other = await accounts.create();
  const ids: Record<string, string> = {};
  for (const kind of ["human", "tie", "zero", "unrelated", "hidden"]) {
    const { data: row, error } = await accounts.admin.from("challenges").insert({ ...template, creator_id: owner.id, situation: kind, joke_context: `Return test ${kind}`, status: "published", published_at: new Date().toISOString(), closes_at: new Date(Date.now() + 86400000).toISOString() }).select("id").single();
    expect(error).toBeNull(); ids[kind] = row!.id;
    const { data: captions, error: captionError } = await accounts.admin.from("challenge_captions").insert(["human", "ai"].map(origin => ({ challenge_id: row!.id, origin, body: `${kind} ${origin} line` }))).select("id,origin");
    expect(captionError).toBeNull();
    if (["human", "tie", "hidden"].includes(kind)) expect((await viewer.client.rpc("vote_caption_challenge", { p_challenge: row!.id, p_caption: captions!.find(c => c.origin === "human")!.id })).error).toBeNull();
    if (kind === "tie") expect((await other.client.rpc("vote_caption_challenge", { p_challenge: row!.id, p_caption: captions!.find(c => c.origin === "ai")!.id })).error).toBeNull();
  }
  // Leave just the two voted rounds open for this stage.
  expect((await accounts.admin.from("challenges").update({ closes_at: "2020-01-01T00:00:00Z" }).in("id", [ids.zero, ids.unrelated, ids.hidden])).error).toBeNull();
  expect((await accounts.admin.from("challenges").update({ hidden_at: new Date().toISOString() }).eq("id", ids.hidden)).error).toBeNull();
  await login(page, viewer);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "You’re caught up." })).toBeVisible();
  await expect(page.locator(".challenge-feed-card")).toHaveCount(2);
  await page.locator(`.challenge-feed-card[href="/challenges/${ids.human}"]`).click();
  await page.getByRole("button", { name: "Undo upvote" }).click();
  await expect(page.getByRole("button", { name: "Upvote", exact: true })).toHaveCount(2);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "You’re caught up." })).toHaveCount(0);
  await page.locator(`.challenge-feed-card[href="/challenges/${ids.human}"]`).click();
  await page.getByRole("button", { name: "Upvote", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Undo upvote" })).toBeEnabled();
  expect((await accounts.admin.from("challenges").update({ closes_at: "2026-01-01T00:00:00Z" }).in("id", [ids.human, ids.tie])).error).toBeNull();
  await page.goto("/");
  const activity = page.getByRole("complementary", { name: "Pick up where you left off" });
  await expect(activity.getByRole("heading", { name: "Your recent results" })).toBeVisible();
  await expect(activity.getByRole("link")).toHaveCount(2);
  await expect(activity.getByRole("alert")).toHaveCount(0);
  await expect(activity.locator(`a[href="/challenges/${ids.hidden}"]`)).toHaveCount(0);
  await expect(activity.locator(`a[href="/challenges/${ids.unrelated}"]`)).toHaveCount(0);
  await page.goto("/challenges?view=results");
  await expect(page.getByRole("heading", { name: /(?:Human|AI) caption wins/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "It’s a tie" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No votes this round" })).toHaveCount(2);
  await expect(page.locator(`a[href="/challenges/${ids.hidden}"]`)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("results-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("results-mobile.png"), fullPage: true });
});

test("results pagination has stable boundaries and a route back from an empty page", async ({ page, accounts }) => {
  const owner = await accounts.create();
  const { data: templates } = await accounts.admin.from("images").select("id,image_url").limit(1);
  const template = { template_id: templates![0].id, template_url: templates![0].image_url };
  const { error } = await accounts.admin.from("challenges").insert(Array.from({ length: 13 }, (_, i) => ({ ...template, creator_id: owner.id, situation: `Past round ${i}`, status: "published", closes_at: "2026-01-01T00:00:00Z" })));
  expect(error).toBeNull();
  await login(page, owner);
  await page.goto("/challenges?view=results");
  await expect(page.locator(".round-result")).toHaveCount(12);
  const first = await page.locator(".round-result a").evaluateAll(links => links.map(a => a.getAttribute("href")));
  await page.getByRole("link", { name: "Older results" }).click();
  await expect(page.locator(".round-result")).toHaveCount(1);
  expect(first).not.toContain(await page.locator(".round-result a").getAttribute("href"));
  await page.goto("/?view=results&page=3");
  await expect(page.getByRole("link", { name: "Previous results" })).toHaveAttribute("href", "/challenges?view=results&page=2");
});
